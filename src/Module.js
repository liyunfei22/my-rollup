import MagicString from "magic-string";
import { parse } from "acorn";
import { walk } from 'estree-walker';
import Statement from './Statement.js';
import { blank, keys } from './utils/object.js';
import { basename, extname } from './utils/path.js';
import getLocation from './utils/getLocation.js';
import makeLegalIdentifier from './utils/makeLegalIdentifier.js';
import SOURCEMAPPING_URL from './utils/sourceMappingURL.js';


class SyntheticDefaultDeclaration {
	constructor ( node, statement, name ) {
		this.node = node;
		this.statement = statement;
		this.name = name;

		this.original = null;
		this.isExported = false;
		this.aliases = [];
	}

	addAlias ( declaration ) {
		this.aliases.push( declaration );
	}

	addReference ( reference ) {
		reference.declaration = this;
		this.name = reference.name;
	}

	bind ( declaration ) {
		this.original = declaration;
	}

	render () {
		return !this.original || this.original.isReassigned ?
			this.name :
			this.original.render();
	}

	use () {
		this.isUsed = true;
		this.statement.mark();

		if ( this.original ) this.original.use();

		this.aliases.forEach( alias => alias.use() );
	}
}

class SyntheticNamespaceDeclaration {
	constructor ( module ) {
		this.module = module;
		this.name = null;

		this.needsNamespaceBlock = false;
		this.aliases = [];

		this.originals = blank();
		module.getExports().forEach( name => {
			this.originals[ name ] = module.traceExport( name );
		});
	}

	addAlias ( declaration ) {
		this.aliases.push( declaration );
	}

	addReference ( reference ) {
		// if we have e.g. `foo.bar`, we can optimise
		// the reference by pointing directly to `bar`
		if ( reference.parts.length ) {
			reference.name = reference.parts.shift();

			reference.end += reference.name.length + 1; // TODO this is brittle

			const original = this.originals[ reference.name ];

			// throw with an informative error message if the reference doesn't exist.
			if ( !original ) {
				const err = new Error( `Export '${reference.name}' is not defined by '${this.module.id}'` );
				err.code = 'MISSING_EXPORT';
				err.file = this.module.id;
				throw err;
			}

			original.addReference( reference );
			return;
		}

		// otherwise we're accessing the namespace directly,
		// which means we need to mark all of this module's
		// exports and render a namespace block in the bundle
		if ( !this.needsNamespaceBlock ) {
			this.needsNamespaceBlock = true;
			this.module.bundle.internalNamespaces.push( this );
		}

		reference.declaration = this;
		this.name = reference.name;
	}

	renderBlock ( indentString ) {
		const members = keys( this.originals ).map( name => {
			const original = this.originals[ name ];

			if ( original.isReassigned ) {
				return `${indentString}get ${name} () { return ${original.render()}; }`;
			}

			return `${indentString}${name}: ${original.render()}`;
		});

		return `var ${this.render()} = Object.freeze({\n${members.join( ',\n' )}\n});\n\n`;
	}

	render () {
		return this.name;
	}

	use () {
		keys( this.originals ).forEach( name => {
			this.originals[ name ].use();
		});

		this.aliases.forEach( alias => alias.use() );
	}
}
export default class Module {
  constructor({ id, code, originalCode, ast, sourceMapChain, bundle }) {
		// 初始化模块实例的属性
    // id: 模块的唯一标识符，通常为文件名
    // code: 模块的源代码
    // originalCode: 原始源代码，用于源码映射
    // ast: 抽象语法树，由解析器生成
    // sourceMapChain: 源码映射链，用于生成源码映射文件
    // bundle: 包含当前模块的打包实例

    this.code = code;
    this.originalCode = originalCode;
    this.sourceMapChain = sourceMapChain;

    this.bundle = bundle;
    this.id = id;

    // 初始化模块的依赖、导入、导出等属性

    this.dependencies = [];
    this.resolvedIds = blank();

    // imports and exports, indexed by local name
    this.imports = blank();
    this.exports = blank();
    this.reexports = blank();

    this.exportAllSources = [];
    this.exportAllModules = null;
		// 使用MagicString处理源代码，支持源码映射
		// 默认情况下，`id` 是文件名。自定义解析器和加载器可以更改这一点，但将其用于源文件名是有意义的。
    this.magicString = new MagicString(code, {
      filename: id,
      indentExclusionRanges: [],
    });

    // 移除源代码中的sourceMappingURL注释
    const pattern = new RegExp(`\\/\\/#\\s+${SOURCEMAPPING_URL}=.+\\n?`, "g");
    let match;
    while ((match = pattern.exec(code))) {
      this.magicString.remove(match.index, match.index + match[0].length);
    }

    this.comments = [];
		// 解析AST生成语句列表
    this.statements = this.parse(ast);
    this.declarations = blank();
    this.analyse();
  }
  // 这段代码的主要作用是将 JavaScript 代码解析成 AST，并对其中的语句进行一些处理，例如拆分多个声明、处理注释等。
  parse(ast) {
		// 使用 Acorn 解析器解析模块的代码
      // ecmaVersion: 6 表示解析 ES6 代码
      // sourceType: 'module' 表示解析为模块代码
      // onComment: 回调函数，用于收集 AST 中的注释信息
      // preserveParens: true 表示保留代码中的括号结构
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
				// 如果解析失败，创建一个错误对象并抛出
        err.code = "PARSE_ERROR";
        err.file = this.id;
        err.message += ` in ${this.id}`;
        throw err;
      }
    }
    // 使用 estree-walker 库遍历 AST 并处理节点
    walk(ast, {
      enter: (node) => {
        // 将节点的起始位置和结束位置添加到 magicString 对象中，用于处理源码映射
        this.magicString.addSourcemapLocation(node.start);
        this.magicString.addSourcemapLocation(node.end);
      },
    });
    // 创建语句数组，用于存储模块中的所有语句
    let statements = [];
    // 上一个语句的结束位置
    let lastChar = 0;
    // 当前处理的注释索引
    let commentIndex = 0;
		// 遍历 AST 的 body 属性，它包含了模块的所有顶级语句
    ast.body.forEach((node) => {
			// 忽略空语句
      if (node.type === "EmptyStatement") return;

			// 处理导出命名声明的特殊情况
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
			// 处理顶级变量声明，如果声明中有多个声明符，则需要拆分
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
				// 处理普通节点
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

	basename () {
		const base = basename( this.id );
		const ext = extname( this.id );

		return makeLegalIdentifier( ext ? base.slice( 0, -ext.length ) : base );
	}

	bindAliases () {
		keys( this.declarations ).forEach( name => {
			if ( name === '*' ) return;

			const declaration = this.declarations[ name ];
			const statement = declaration.statement;

			if ( statement.node.type !== 'VariableDeclaration' ) return;

			statement.references.forEach( reference => {
				if ( reference.name === name || !reference.isImmediatelyUsed ) return;

				const otherDeclaration = this.trace( reference.name );
				if ( otherDeclaration ) otherDeclaration.addAlias( declaration );
			});
		});
	}

	bindImportSpecifiers () {
		[ this.imports, this.reexports ].forEach( specifiers => {
			keys( specifiers ).forEach( name => {
				const specifier = specifiers[ name ];

				const id = this.resolvedIds[ specifier.source ];
				specifier.module = this.bundle.moduleById[ id ];
			});
		});

		this.exportAllModules = this.exportAllSources.map( source => {
			const id = this.resolvedIds[ source ];
			return this.bundle.moduleById[ id ];
		});
	}

	bindReferences () {
		if ( this.declarations.default ) {
			if ( this.exports.default.identifier ) {
				const declaration = this.trace( this.exports.default.identifier );
				if ( declaration ) this.declarations.default.bind( declaration );
			}
		}

		this.statements.forEach( statement => {
			// skip `export { foo, bar, baz }`...
			if ( statement.node.type === 'ExportNamedDeclaration' && statement.node.specifiers.length ) {
				// ...unless this is the entry module
				if ( this !== this.bundle.entryModule ) return;
			}

			statement.references.forEach( reference => {
				const declaration = reference.scope.findDeclaration( reference.name ) ||
				                    this.trace( reference.name );

				if ( declaration ) {
					declaration.addReference( reference );
				} else {
					// TODO handle globals
					this.bundle.assumedGlobals[ reference.name ] = true;
				}
			});
		});
	}

	consolidateDependencies () {
		let strongDependencies = blank();
		let weakDependencies = blank();

		// treat all imports as weak dependencies
		this.dependencies.forEach( source => {
			const id = this.resolvedIds[ source ];
			const dependency = this.bundle.moduleById[ id ];

			if ( !dependency.isExternal ) {
				weakDependencies[ dependency.id ] = dependency;
			}
		});

		// identify strong dependencies to break ties in case of cycles
		this.statements.forEach( statement => {
			statement.references.forEach( reference => {
				const declaration = reference.declaration;

				if ( declaration && declaration.statement ) {
					const module = declaration.statement.module;
					if ( module === this ) return;

					// TODO disregard function declarations
					if ( reference.isImmediatelyUsed ) {
						strongDependencies[ module.id ] = module;
					}
				}
			});
		});

		return { strongDependencies, weakDependencies };
	}

	getExports () {
		let exports = blank();

		keys( this.exports ).forEach( name => {
			exports[ name ] = true;
		});

		keys( this.reexports ).forEach( name => {
			exports[ name ] = true;
		});

		this.exportAllModules.forEach( module => {
			module.getExports().forEach( name => {
				if ( name !== 'default' ) exports[ name ] = true;
			});
		});

		return keys( exports );
	}

	markAllSideEffects () {
		let hasSideEffect = false;

		this.statements.forEach( statement => {
			if ( statement.markSideEffect() ) hasSideEffect = true;
		});

		return hasSideEffect;
	}

	namespace () {
		if ( !this.declarations['*'] ) {
			this.declarations['*'] = new SyntheticNamespaceDeclaration( this );
		}

		return this.declarations['*'];
	}

	parse ( ast ) {
		// 抽象语法树可以通过程序提供（但通常不会）
		if ( !ast ) {
			// 尝试提取顶层语句/声明的列表。如果解析失败，附加文件信息并中止
			try {
				ast = parse( this.code, {
					ecmaVersion: 6,
					sourceType: 'module',
					onComment: ( block, text, start, end ) => this.comments.push({ block, text, start, end }),
					preserveParens: true
				});
			} catch ( err ) {
				err.code = 'PARSE_ERROR';
				err.file = this.id; // see above - not necessarily true, but true enough
				err.message += ` in ${this.id}`;
				throw err;
			}
		}

		walk( ast, {
			enter: node => {
				this.magicString.addSourcemapLocation( node.start );
				this.magicString.addSourcemapLocation( node.end );
			}
		});

		let statements = [];
		let lastChar = 0;
		let commentIndex = 0;

		ast.body.forEach( node => {
			if ( node.type === 'EmptyStatement' ) return;

			if (
				node.type === 'ExportNamedDeclaration' &&
				node.declaration &&
				node.declaration.type === 'VariableDeclaration' &&
				node.declaration.declarations &&
				node.declaration.declarations.length > 1
			) {
				// push a synthetic export declaration
				const syntheticNode = {
					type: 'ExportNamedDeclaration',
					specifiers: node.declaration.declarations.map( declarator => {
						const id = { name: declarator.id.name };
						return {
							local: id,
							exported: id
						};
					}),
					isSynthetic: true
				};

				const statement = new Statement( syntheticNode, this, node.start, node.start );
				statements.push( statement );

				this.magicString.remove( node.start, node.declaration.start );
				node = node.declaration;
			}

			// 特殊情况 - 具有多个声明符号的顶层 var 声明应该被拆分。
			// 否则，
			// 我们可能会包含不需要的代码，只是因为包含了不需要的声明符号
			if ( node.type === 'VariableDeclaration' && node.declarations.length > 1 ) {
				// remove the leading var/let/const... UNLESS the previous node
				// was also a synthetic node, in which case it'll get removed anyway
				const lastStatement = statements[ statements.length - 1 ];
				if ( !lastStatement || !lastStatement.node.isSynthetic ) {
					this.magicString.remove( node.start, node.declarations[0].start );
				}

				node.declarations.forEach( declarator => {
					const { start, end } = declarator;

					const syntheticNode = {
						type: 'VariableDeclaration',
						kind: node.kind,
						start,
						end,
						declarations: [ declarator ],
						isSynthetic: true
					};

					const statement = new Statement( syntheticNode, this, start, end );
					statements.push( statement );
				});

				lastChar = node.end; // TODO account for trailing line comment
			}

			else {
				let comment;
				do {
					comment = this.comments[ commentIndex ];
					if ( !comment ) break;
					if ( comment.start > node.start ) break;
					commentIndex += 1;
				} while ( comment.end < lastChar );

				const start = comment ? Math.min( comment.start, node.start ) : node.start;
				const end = node.end; // TODO account for trailing line comment

				const statement = new Statement( node, this, start, end );
				statements.push( statement );

				lastChar = end;
			}
		});

		let i = statements.length;
		let next = this.code.length;
		while ( i-- ) {
			statements[i].next = next;
			if ( !statements[i].isSynthetic ) next = statements[i].start;
		}

		return statements;
	}

	render ( es6 ) {
		let magicString = this.magicString.clone();

		this.statements.forEach( statement => {
			if ( !statement.isIncluded ) {
				magicString.remove( statement.start, statement.next );
				return;
			}

			statement.stringLiteralRanges.forEach( range => magicString.indentExclusionRanges.push( range ) );

			// skip `export { foo, bar, baz }`
			if ( statement.node.type === 'ExportNamedDeclaration' ) {
				if ( statement.node.isSynthetic ) return;

				// skip `export { foo, bar, baz }`
				if ( statement.node.specifiers.length ) {
					magicString.remove( statement.start, statement.next );
					return;
				}
			}

			// split up/remove var declarations as necessary
			if ( statement.node.isSynthetic ) {
				// insert `var/let/const` if necessary
				const declaration = this.declarations[ statement.node.declarations[0].id.name ];
				if ( !( declaration.isExported && declaration.isReassigned ) ) { // TODO encapsulate this
					magicString.insert( statement.start, `${statement.node.kind} ` );
				}

				magicString.overwrite( statement.end, statement.next, ';\n' ); // TODO account for trailing newlines
			}

			let toDeshadow = blank();

			statement.references.forEach( reference => {
				const declaration = reference.declaration;

				if ( declaration ) {
					const { start, end } = reference;
					const name = declaration.render( es6 );

					// the second part of this check is necessary because of
					// namespace optimisation – name of `foo.bar` could be `bar`
					if ( reference.name === name && name.length === reference.end - reference.start ) return;

					reference.rewritten = true;

					// prevent local variables from shadowing renamed references
					const identifier = name.match( /[^\.]+/ )[0];
					if ( reference.scope.contains( identifier ) ) {
						toDeshadow[ identifier ] = `${identifier}$$`; // TODO more robust mechanism
					}

					if ( reference.isShorthandProperty ) {
						magicString.insert( end, `: ${name}` );
					} else {
						magicString.overwrite( start, end, name, true );
					}
				}
			});

			if ( keys( toDeshadow ).length ) {
				statement.references.forEach( reference => {
					if ( !reference.rewritten && reference.name in toDeshadow ) {
						magicString.overwrite( reference.start, reference.end, toDeshadow[ reference.name ], true );
					}
				});
			}

			// modify exports as necessary
			if ( statement.isExportDeclaration ) {
				// remove `export` from `export var foo = 42`
				if ( statement.node.type === 'ExportNamedDeclaration' && statement.node.declaration.type === 'VariableDeclaration' ) {
					const name = statement.node.declaration.declarations[0].id.name;
					const declaration = this.declarations[ name ];

					const end = declaration.isExported && declaration.isReassigned ?
						statement.node.declaration.declarations[0].start :
						statement.node.declaration.start;

					magicString.remove( statement.node.start, end );
				}

				else if ( statement.node.type === 'ExportAllDeclaration' ) {
					// TODO: remove once `export * from 'external'` is supported.
					magicString.remove( statement.start, statement.next );
				}

				// remove `export` from `export class Foo {...}` or `export default Foo`
				// TODO default exports need different treatment
				else if ( statement.node.declaration.id ) {
					magicString.remove( statement.node.start, statement.node.declaration.start );
				}

				else if ( statement.node.type === 'ExportDefaultDeclaration' ) {
					const defaultDeclaration = this.declarations.default;

					// prevent `var foo = foo`
					if ( defaultDeclaration.original && !defaultDeclaration.original.isReassigned ) {
						magicString.remove( statement.start, statement.next );
						return;
					}

					const defaultName = defaultDeclaration.render();

					// prevent `var undefined = sideEffectyDefault(foo)`
					if ( !defaultDeclaration.isExported && !defaultDeclaration.isUsed ) {
						magicString.remove( statement.start, statement.node.declaration.start );
						return;
					}

					// anonymous functions should be converted into declarations
					if ( statement.node.declaration.type === 'FunctionExpression' ) {
						magicString.overwrite( statement.node.start, statement.node.declaration.start + 8, `function ${defaultName}` );
					} else {
						magicString.overwrite( statement.node.start, statement.node.declaration.start, `var ${defaultName} = ` );
					}
				}

				else {
					throw new Error( 'Unhandled export' );
				}
			}
		});

		// add namespace block if necessary
		const namespace = this.declarations['*'];
		if ( namespace && namespace.needsNamespaceBlock ) {
			magicString.append( '\n\n' + namespace.renderBlock( magicString.getIndentString() ) );
		}

		return magicString.trim();
	}

	trace ( name ) {
		if ( name in this.declarations ) return this.declarations[ name ];
		if ( name in this.imports ) {
			const importDeclaration = this.imports[ name ];
			const otherModule = importDeclaration.module;

			if ( importDeclaration.name === '*' && !otherModule.isExternal ) {
				return otherModule.namespace();
			}

			return otherModule.traceExport( importDeclaration.name, this );
		}

		return null;
	}

	traceExport ( name, importer ) {
		// export { foo } from './other'
		const reexportDeclaration = this.reexports[ name ];
		if ( reexportDeclaration ) {
			return reexportDeclaration.module.traceExport( reexportDeclaration.localName, this );
		}

		const exportDeclaration = this.exports[ name ];
		if ( exportDeclaration ) {
			return this.trace( exportDeclaration.localName );
		}

		for ( let i = 0; i < this.exportAllModules.length; i += 1 ) {
			const module = this.exportAllModules[i];
			const declaration = module.traceExport( name, this );

			if ( declaration ) return declaration;
		}

		let errorMessage = `Module ${this.id} does not export ${name}`;
		if ( importer ) errorMessage += ` (imported by ${importer.id})`;

		throw new Error( errorMessage );
	}
}
