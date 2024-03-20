import MagicString from "magic-string";
import { parse } from "acorn";

export default class Module {
  constructor({ id, code, originalCode, ast, sourceMapChain, bundle }) {
    this.code = code;
    this.originalCode = originalCode;
    this.sourceMapChain = sourceMapChain;

    this.bundle = bundle;
    this.id = id;

    // all dependencies
    this.dependencies = [];
    this.resolvedIds = blank();

    // imports and exports, indexed by local name
    this.imports = blank();
    this.exports = blank();
    this.reexports = blank();

    this.exportAllSources = [];
    this.exportAllModules = null;

    this.magicString = new MagicString(code, {
      filename: id,
      indentExclusionRanges: [],
    });

    // 去掉sourceMappingURL
    const pattern = new RegExp(`\\/\\/#\\s+${SOURCEMAPPING_URL}=.+\\n?`, "g");
    let match;
    while ((match = pattern.exec(code))) {
      this.magicString.remove(match.index, match.index + match[0].length);
    }

    this.comments = [];
    this.statements = this.parse(ast);
    this.declarations = blank();
    this.analyse();
  }
  // 这段代码的主要作用是将 JavaScript 代码解析成 AST，并对其中的语句进行一些处理，例如拆分多个声明、处理注释等。
  parse(ast) {
    if (!ast) {
      try {
        ast = parse(this.code, {
          ecmaVersion: 6,
          sourceType: "module",
          onComment: (block, text, start, end) =>
            this.comments.push({ block, text, start, end }), // 收集注释信息，并存储在 this.comments 中
          preserveParens: true,
        });
      } catch (err) {
        err.code = "PARSE_ERROR";
        err.file = this.id;
        err.message += ` in ${this.id}`;
        throw err;
      }
    }
    // walk 方法遍历 AST，对每个节点进行处理
    walk(ast, {
      enter: (node) => {
        // 将节点的起始位置和结束位置添加到 magicString 对象中，用于处理源码映射
        this.magicString.addSourcemapLocation(node.start);
        this.magicString.addSourcemapLocation(node.end);
      },
    });
    // 用于存储解析后的语句
    let statements = [];
    // 记录上一个节点的结束位置
    let lastChar = 0;
    // 用于迭代注释
    let commentIndex = 0;
    ast.body.forEach((node) => {
      if (node.type === "EmptyStatement") return;

			//生成一个合成的导出声明，并添加到 statements 中。
      if (
        node.type === "ExportNamedDeclaration" &&
        node.declaration &&
        node.declaration.type === "VariableDeclaration" &&
        node.declaration.declarations &&
        node.declaration.declarations.length > 1
      ) {
        // push a synthetic export declaration
        const syntheticNode = {
          type: "ExportNamedDeclaration",
          specifiers: node.declaration.declarations.map((declarator) => {
            const id = { name: declarator.id.name };
            return {
              local: id,
              exported: id,
            };
          }),
          isSynthetic: true,
        };

        const statement = new Statement(
          syntheticNode,
          this,
          node.start,
          node.start
        );
        statements.push(statement);

        this.magicString.remove(node.start, node.declaration.start);
        node = node.declaration;
      }

      // 将其拆分成多个独立的声明，并添加到 statements 中。

      if (node.type === "VariableDeclaration" && node.declarations.length > 1) {
        const lastStatement = statements[statements.length - 1];
        if (!lastStatement || !lastStatement.node.isSynthetic) {
          this.magicString.remove(node.start, node.declarations[0].start);
        }

        node.declarations.forEach((declarator) => {
          const { start, end } = declarator;

          const syntheticNode = {
            type: "VariableDeclaration",
            kind: node.kind,
            start,
            end,
            declarations: [declarator],
            isSynthetic: true,
          };

          const statement = new Statement(syntheticNode, this, start, end);
          statements.push(statement);
        });

        lastChar = node.end; // TODO account for trailing line comment
      } else {
				// 生成一个 Statement 对象，表示一个语句，并添加到 statements 中。
        let comment;
        do {
          comment = this.comments[commentIndex];
          if (!comment) break;
          if (comment.start > node.start) break;
          commentIndex += 1;
        } while (comment.end < lastChar);

        const start = comment
          ? Math.min(comment.start, node.start)
          : node.start;
        const end = node.end; // TODO account for trailing line comment

        const statement = new Statement(node, this, start, end);
        statements.push(statement);

        lastChar = end;
      }
    });

    let i = statements.length;
    let next = this.code.length;
    while (i--) {
      statements[i].next = next;
      if (!statements[i].isSynthetic) next = statements[i].start;
    }

    return statements;
  }
	addExport ( statement ) {
		const node = statement.node;
		const source = node.source && node.source.value;

		// export { name } from './other'
		if ( source ) {
			// 如果语句是从其他模块导入的（例如 export { name } from './other'），则将源模块添加到依赖列表中，并将导入的内容存储在 reexports 或 exports.default 中，以便后续进行处理。
			if ( !~this.dependencies.indexOf( source ) ) this.dependencies.push( source );

			if ( node.type === 'ExportAllDeclaration' ) {
				// Store `export * from '...'` statements in an array of delegates.
				// When an unknown import is encountered, we see if one of them can satisfy it.
				this.exportAllSources.push( source );
			}

			else {
				node.specifiers.forEach( specifier => {
					this.reexports[ specifier.exported.name ] = {
						source,
						localName: specifier.local.name,
						module: null // filled in later
					};
				});
			}
		}

		// export default function foo () {}
		// export default foo;
		// export default 42;
		// 如果语句是默认导出（例如 export default function foo() {}），则将默认导出的内容存储在 exports.default 中，并创建一个合成的默认导出声明。
		else if ( node.type === 'ExportDefaultDeclaration' ) {
			const identifier = ( node.declaration.id && node.declaration.id.name ) || node.declaration.name;

			this.exports.default = {
				localName: 'default',
				identifier
			};

			// create a synthetic declaration
			this.declarations.default = new SyntheticDefaultDeclaration( node, statement, identifier || this.basename() );
		}

		// export { foo, bar, baz }
		// export var foo = 42;
		// export var a = 1, b = 2, c = 3;
		// export function foo () {}
		// 如果语句是命名导出（例如 export { foo, bar, baz } 或 export var foo = 42），则将每个导出的内容存储在 exports 中，以便后续进行处理。
		else if ( node.type === 'ExportNamedDeclaration' ) {
			if ( node.specifiers.length ) {
				// export { foo, bar, baz }
				node.specifiers.forEach( specifier => {
					const localName = specifier.local.name;
					const exportedName = specifier.exported.name;

					this.exports[ exportedName ] = { localName };
				});
			}

			else {
				let declaration = node.declaration;

				let name;

				if ( declaration.type === 'VariableDeclaration' ) {
					// export var foo = 42
					name = declaration.declarations[0].id.name;
				} else {
					// export function foo () {}
					name = declaration.id.name;
				}

				this.exports[ name ] = { localName: name };
			}
		}
	}

	addImport ( statement ) {
		// 这个方法用于处理导入语句。它将导入的模块添加到依赖列表中，并将每个导入的内容存储在 imports 中，以便后续进行处理。如果遇到重复的导入内容，则会抛出一个错误
		const node = statement.node;
		const source = node.source.value;

		if ( !~this.dependencies.indexOf( source ) ) this.dependencies.push( source );

		node.specifiers.forEach( specifier => {
			const localName = specifier.local.name;

			if ( this.imports[ localName ] ) {
				const err = new Error( `Duplicated import '${localName}'` );
				err.file = this.id;
				err.loc = getLocation( this.code, specifier.start );
				throw err;
			}

			const isDefault = specifier.type === 'ImportDefaultSpecifier';
			const isNamespace = specifier.type === 'ImportNamespaceSpecifier';

			const name = isDefault ? 'default' : isNamespace ? '*' : specifier.imported.name;
			this.imports[ localName ] = { source, name, module: null };
		});
	}
  analyse() {
		//这个方法用于分析语句列表中的每个语句。它会遍历所有语句，并根据语句的类型调用 addImport 或 addExport 方法进行处理。然后，它会对每个语句进行分析，并将其中的声明存储在 declarations 中。这个方法最终会构建模块的导入和导出信息，以便后续对模块进行处理。
		this.statements.forEach( statement => {
			if ( statement.isImportDeclaration ) this.addImport( statement );
			else if ( statement.isExportDeclaration ) this.addExport( statement );

			statement.analyse();

			statement.scope.eachDeclaration( ( name, declaration ) => {
				this.declarations[ name ] = declaration;
			});
		});
	}
}
