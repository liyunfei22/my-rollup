# acorn

A tiny, fast JavaScript parser written in JavaScript.

一个解析ast的包

## 接口
### parse
parse(input, options)是该库的主要接口。input参数是一个字符串，options必须是一个对象，设置下面列出的一些选项之一。返回值将是一个由ESTree规范指定的抽象语法树对象。

```javascript
let acorn = require("acorn");
console.log(acorn.parse("1 + 1", {ecmaVersion: 2020}));
```

当遇到语法错误时，解析器将引发一个具有有意义消息的SyntaxError对象。错误对象将具有一个pos属性，指示发生错误的字符串偏移量，以及一个loc对象，其中包含一个{line, column}对象，引用相同的位置。

选项由第二个参数提供，它应该是一个包含以下任何字段的对象（只有ecmaVersion是必需的）：

- ecmaVersion：指示要解析的ECMAScript版本。必须是3、5、6（或2015）、7（2016）、8（2017）、9（2018）、10（2019）、11（2020）、12（2021）、13（2022）、14（2023）或“latest”（库支持的最新版本）。这会影响对严格模式的支持、保留字集合和对新语法功能的支持。

注意：Acorn只实现了“阶段4”（最终确定）的ECMAScript功能。其他提议的新功能必须通过插件实现。

- sourceType：指示应该解析代码的模式。可以是“script”或“module”。这会影响全局严格模式以及import和export声明的解析。

注意：如果设置为“module”，即使ecmaVersion小于6，静态导入/导出语法也将有效。

- onInsertedSemicolon：如果给定回调，则解析器插入分号时将调用该回调。回调将被给予分号插入的字符偏移量作为参数，并且如果locations为true，则还会给出一个表示此位置的{line, column}对象。

- onTrailingComma：类似于onInsertedSemicolon，但用于尾随逗号。

- allowReserved：如果为false，则使用保留字将生成错误。对于ecmaVersion 3，默认为true，对于更高版本，默认为false。当给定值为“never”时，保留字和关键字也不能用作属性名称（如Internet Explorer的旧解析器）。

- allowReturnOutsideFunction：默认情况下，顶级的return语句会引发错误。将其设置为true以接受此类代码。

- allowImportExportEverywhere：默认情况下，import和export声明只能出现在程序的顶级。将此选项设置为true允许它们出现在任何允许语句的地方，并且还允许在脚本中出现import.meta表达式（当sourceType不是“module”时）。

- allowAwaitOutsideFunction：如果为false，则await表达式只能出现在async函数内部。对于ecmaVersion 2022及更高版本的模块，默认为true，对于较低版本的模块，默认为false。将此选项设置为true允许具有顶级await表达式。但它们仍然不允许出现在非异步函数中。

- allowSuperOutsideMethod：默认情况下，超出方法的super引发错误。将其设置为true以接受此类代码。

- allowHashBang：启用此选项时，如果代码以#!（如shell脚本）开头，则第一行将被视为注释。当ecmaVersion >= 2023时，默认为true。

- checkPrivateFields：默认情况下，解析器将验证私有属性仅在它们有效且已声明的位置使用。将其设置为false以关闭此类检查。

- locations：当为true时，每个节点都附有一个带有start和end子对象的loc对象，每个子对象都包含以{line, column}形式的一个基于一的行和基于零的列号。默认为false。

- onToken：如果为此选项传递了函数，则每个找到的标记将以与tokenizer().getToken()返回的标记相同的格式传递。

如果传递了数组，则每个找到的标记都将被推送到其中。

请注意，不允许从回调中调用解析器——这将破坏其内部状态。

- onComment：如果为此选项传递了函数，则每当遇到注释时，将调用该函数，并传递以下参数：

  - block：如果注释是块注释，则为true；如果是行注释，则为false。
  - text：注释的内容。
  - start：注释起始字符的偏移量。
  - end：注释结束字符的偏移量。

当locations选项为true时，注释的起始和结束的{line, column}位置将作为额外的两个参数传递。

如果为此选项传递了数组，则每个找到的注释将以Esprima格式的对象形式推送到其中：

```json
{
  "type": "Line" | "Block",
  "value": "注释文本",
  "start": 数字,
  "end": 数字,
  // 如果 `locations` 选项已开启:
  "loc": {
    "start": {line: 数字, column: 数字}
    "end": {line: 数字, column: 数字}
  },
  // 如果 `ranges` 选项已开启:
  "range": [数字, 数字]
}
```

请注意，不允许从回调中调用解析器——这将破坏其内部状态。

- ranges：节点的开始和结束字符偏移量将记录在start和end属性中（直接在节点上，而不是在保存行/列数据的loc对象中）。为了还添加一个半标准化的range属性，其中包含一个相同数字的[start, end]数组，将ranges选项设置为true。

- program：可以通过将第一个文件
解析的树作为后续解析的程序选项传递，将多个文件解析为单个AST。这将把解析文件的顶级形式添加到现有解析树的"Program"（顶级）节点中。

- sourceFile：当locations选项为true时，您可以传递此选项以在每个节点的loc对象中添加一个source属性。请注意，此选项的内容不会以任何方式检查或处理；您可以自由选择任何格式。

- directSourceFile：与sourceFile类似，但一个sourceFile属性将直接添加到节点中，而不是loc对象中（无论位置选项如何）。

- preserveParens：如果此选项为true，则括号表达式将由（非标准的）ParenthesizedExpression节点表示，其中包含一个包含括号内表达式的单个expression属性。

### parseExpressionAt
parseExpressionAt(input, offset, options)将解析字符串中的单个表达式，并返回其AST。如果表达式之后还有字符串剩余，它不会报错。
### tokenizer
tokenizer(input, options)返回一个带有getToken方法的对象，可以重复调用该方法以获取下一个标记，一个{start, end, type, value}对象（当启用locations选项时，还包括loc属性，当启用ranges选项时，还包括range属性）。当标记的类型是tokTypes.eof时，应停止调用该方法，因为它将永远返回同一个标记。

请注意，JavaScript的标记化而不解析，在现代语言版本中实际上是不可能的，因为语法的重载方式只能通过解析上下文来消除歧义。此包应用了一系列启发式方法来尝试做出合理的工作，但建议您使用带有onToken选项的parse，而不是使用此方法。

在ES6环境中，返回的结果可以像任何其他符合协议的可迭代对象一样使用：

```javascript
for (let token of acorn.tokenizer(str)) {
  // 遍历标记
}

// 将代码转换为标记数组：
var tokens = [...acorn.tokenizer(str)];
```
### getLineInfo
tokTypes保存一个对象，将名称映射到最终位于标记的type属性中的标记类型对象。

getLineInfo(input, offset)可用于获取给定程序字符串和偏移量的{line, column}对象。

## 解析器类
解析器类的实例包含驱动解析的所有状态和逻辑。它具有与同名顶级函数相匹配的静态方法parse、parseExpressionAt和tokenizer。

当使用插件扩展解析器时，您需要在类的扩展版本上调用这些方法。要使用插件扩展解析器，可以使用其静态extend方法。

```javascript
var acorn = require("acorn");
var jsx = require("acorn-jsx");
var JSXParser = acorn.Parser.extend(jsx());
JSXParser.parse("foo(<bar/>)", {ecmaVersion: 2020});
```

extend方法接受任意数量的插件值，并返回包含插件提供的额外解析器逻辑的新Parser类。
