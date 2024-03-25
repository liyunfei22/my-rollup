// 从 utils/object.js 导入 blank 和 keys 函数
import { blank, keys } from '../utils/object.js';

// extractors 对象包含用于从特定类型的 AST 节点中提取变量名的函数
const extractors = {
  // 处理 Identifier 类型的节点，将变量名添加到 names 数组中
  Identifier(names, param) {
    names.push(param.name);
  },

  // 处理 ObjectPattern 类型的节点，遍历其 properties 并递归调用对应的提取函数
  ObjectPattern(names, param) {
    param.properties.forEach(prop => {
      extractors[prop.key.type](names, prop.key);
    });
  },

  // 处理 ArrayPattern 类型的节点，遍历其 elements 并递归调用对应的提取函数
  ArrayPattern(names, param) {
    param.elements.forEach(element => {
      if (element) { // 忽略空元素
        extractors[element.type](names, element);
      }
    });
  },

  // 处理 RestElement 类型的节点，递归调用其 argument 的类型对应的提取函数
  RestElement(names, param) {
    extractors[param.argument.type](names, param.argument);
  },

  // 处理 AssignmentPattern 类型的节点，递归调用其 left 的类型对应的提取函数
  AssignmentPattern(names, param) {
    return extractors[param.left.type](names, param.left);
  }
};

// extractNames 函数根据 param 的类型调用对应的 extractors 函数，并返回提取的变量名数组
function extractNames(param) {
  let names = [];
  extractors[param.type](names, param);
  return names;
}

// Declaration 类表示一个变量声明，包含声明的相关信息和操作
class Declaration {
  constructor() {
    this.statement = null; // 引用到声明的语句
    this.name = null; // 声明的变量名

    this.isReassigned = false; // 是否被重新赋值
    this.aliases = []; // 别名声明的数组
  }

  // 添加一个别名声明
  addAlias(declaration) {
    this.aliases.push(declaration);
  }

  // 添加一个引用，并更新声明的相关信息
  addReference(reference) {
    reference.declaration = this;
    this.name = reference.name; // 更新声明的变量名
    if (reference.isReassignment) this.isReassigned = true; // 如果是重新赋值，标记为 true
  }

  // 渲染声明，根据是否使用 ES6 语法和声明的其他属性返回不同的字符串
  render(es6) {
    if (es6) return this.name;
    if (!this.isReassigned || !this.isExported) return this.name;
    return `exports.${this.name}`;
  }

  // 使用声明，标记为已使用，并递归标记其别名为已使用
  use() {
    this.isUsed = true;
    if (this.statement) this.statement.mark();
    this.aliases.forEach(alias => alias.use());
  }
}

// Scope 类表示一个作用域，管理其中的变量声明和引用
export default class Scope {
  constructor(options) {
    options = options || {};

    // 父级作用域
    this.parent = options.parent;
    // 是否为块级作用域
    this.isBlockScope = !!options.block;

    // 存储作用域中的声明
    this.declarations = blank();

    // 如果提供了参数，初始化作用域时添加参数声明
    if (options.params) {
      options.params.forEach(param => {
        extractNames(param).forEach(name => {
          this.declarations[name] = new Declaration(name);
        });
      });
    }
  }

  // 添加声明到当前作用域或父作用域
  addDeclaration(node, isBlockDeclaration, isVar) {
    if (!isBlockDeclaration && this.isBlockScope) {
      // 如果当前作用域是块级作用域，且声明不是块级声明，则添加到父作用域
      this.parent.addDeclaration(node, isBlockDeclaration, isVar);
    } else {
      // 否则，提取节点 id 的变量名并添加到当前作用域
      extractNames(node.id).forEach(name => {
        this.declarations[name] = new Declaration(name);
      });
    }
  }

  // 检查作用域是否包含给定名称的变量
  contains(name) {
    // 如果当前作用域包含该变量，则返回 true
    return this.declarations[name] ||
           // 否则，如果有父作用域，则检查父作用域
           (this.parent ? this.parent.contains(name) : false);
  }

  // 遍历作用域中的每个声明并执行回调函数
  eachDeclaration(fn) {
    keys(this.declarations).forEach(key => {
      fn(key, this.declarations[key]);
    });
  }

  // 查找给定名称的声明，如果当前作用域没有找到，则在父作用域中查找
  findDeclaration(name) {
    return this.declarations[name] ||
           // 如果当前作用域没有找到声明，并且存在父作用域，则在父作用域中查找
           (this.parent && this.parent.findDeclaration(name));
  }
}