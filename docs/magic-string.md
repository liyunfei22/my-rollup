
# magic-string

假设你有一些源代码。你想对它进行一些轻微的修改 - 在这里和那里替换一些字符，用头部和尾部包裹起来等等 - 理想情况下，你希望最终能生成一个源映射。你考虑过使用类似 recast 的东西（它允许你从一些 JavaScript 生成 AST，对其进行操作，并重新打印它，同时保留你的注释和格式），但这似乎对你的需求有些过于复杂（或者源代码不是 JavaScript）。坦率地说，你的需求相当特殊。但这也是我所拥有的需求，为此我创建了 magic-string。它是一个小巧、快速的字符串操作实用程序，可以生成源映射。

## examples

```js
import MagicString from 'magic-string';
import fs from 'fs'

const s = new MagicString('problems = 99');

s.update(0, 8, 'answer');
s.toString(); // 'answer = 99'

s.update(11, 13, '42'); // character indices always refer to the original string
s.toString(); // 'answer = 42'

s.prepend('var ').append(';'); // most methods are chainable
s.toString(); // 'var answer = 42;'

const map = s.generateMap({
  source: 'source.js',
  file: 'converted.js.map',
  includeContent: true
}); // generates a v3 sourcemap

fs.writeFileSync('converted.js', s.toString());
fs.writeFileSync('converted.js.map', map.toString());
```

## 方法

- s.addSourcemapLocation( index )
将指定的字符索引（相对于原始字符串）添加到源映射映射中，如果 hires 为 false（见下文）。

- s.append( content )
将指定的内容附加到字符串末尾。返回当前实例。

- s.appendLeft( index, content )
在原始字符串的索引处附加指定的内容。如果随后移动以 index 结尾的范围，则插入内容也将随之移动。返回当前实例。参见 s.prependLeft(...)。

- s.appendRight( index, content )
在原始字符串的索引处附加指定的内容。如果随后移动以 index 开始的范围，则插入内容也将随之移动。返回当前实例。参见 s.prependRight(...)。

- s.clone()
执行你期望的操作。

- s.generateDecodedMap( options )
生成一个包含原始映射数据的源映射对象，以数组形式，而不是编码为字符串。有关选项的详细信息，请参阅下面的 generateMap 文档。如果需要进一步操作源映射，则此选项很有用，但大多数情况下您将使用 generateMap。

- s.generateMap( options )
生成版本 3 的源映射。所有选项都是可选的：

file - 您计划写入源映射的文件名
source - 包含原始源代码的文件名
includeContent - 是否在映射的 sourcesContent 数组中包含原始内容
hires - 映射是否应为高分辨率。高分辨率映射将每个字符都映射，这意味着（例如）您的开发工具将始终能够准确地确定函数调用等的位置。对于低分辨率映射，开发工具可能只能识别正确的行 - 但生成速度更快，体积更小。您还可以设置 "boundary" 以生成基于单词边界而不是字符的半高分辨率映射，适用于由单词分隔的字符串语义。如果已经使用 s.addSourcemapLocation() 指定了源映射位置，则将在此处使用它们。
返回的源映射附带了两个（不可枚举的）方法，以方便使用：

toString - 返回等效于 JSON.stringify(map) 的内容
toUrl - 返回包含源映射的 DataURI。用于执行此类操作时很有用：
code += '\n//# sourceMappingURL=' + map.toUrl();

- s.hasChanged()
指示字符串是否已更改。

- s.indent( prefix[, options] )
用指定的前缀为字符串的每一行添加缩进。如果未提供前缀，则将从原始内容中猜测缩进，作为回退使用单个制表符。返回当前实例。

options 参数可以有一个 exclude 属性，它是一个 [start, end] 字符范围的数组。这些范围将从缩进中排除 - 对于（例如）多行字符串很有用。

- s.insertLeft( index, content )
自 0.17 版本起已弃用 – 请改用 s.appendLeft(...)。

- s.insertRight( index, content )
自 0.17 版本起已弃用 – 请改用 s.prependRight(...)。

- s.isEmpty()
如果结果源为空（忽略空白），则返回 true。

- s.locate( index )
自 0.10 版本起已弃用 – 请参见＃30。

- s.locateOrigin( index )
自 0.10 版本起已弃用 – 请参见＃30。

- s.move( start, end, index )
将从 start 和 end 开始的字符移动到 index。返回当前实例。

- s.overwrite( start, end, content[, options] )
用内容替换从 start 到 end 的字符，并包括该范围中追加/前置的内容。适用于 s.remove() 相同的限制。返回当前实例。

第四个参数是可选的。它可以有一个 storeName 属性 —— 如果为 true，则原始名称将存储以便稍后包含在源映射的 names 数组中 —— 和一个 contentOnly 属性，确定是否仅覆盖内容，或者是否还覆盖了范围中追加/前置的任何内容。

如果您希望避免覆盖追加/前置的内容，则可能更喜欢使用 s.update(...)。

- s.prepend( content )
用指定的内容在字符串前面添加。返回当前实例。

- s.prependLeft( index, content )
与 s.appendLeft(...) 相同，只是插入的内容将放在 index 处之前的任何先前追加或前置内容之前。

- s.prependRight( index, content )
与 s.appendRight(...) 相同，只是插入的内容将放在 index 处之前的任何先前追加或前置内容之前。

- s.replace( regexpOrString, substitution )
使用 RegExp 或字符串进行字符串替换。当使用 RegExp 时，还支持替换函数。返回当前实例。

```js
import MagicString from 'magic-string'

const s = new MagicString(source)

s.replace('foo', 'bar')
s.replace(/foo/g, 'bar')
s.replace(/(\w)(\d+)/g, (_, $1, $2) => $1.toUpperCase() + $2)
```

与 String.replace 的区别：

它始终匹配原始字符串
它改变了魔术字符串的状态（使用 .clone() 使其不可变）
s.replaceAll( regexpOrString, substitution )
与 s.replace 相同，但是替换所有匹配的字符串而不仅仅是一个。如果 substitution 是正则表达式，则必须设置全局（g）标志，否则将抛出 TypeError。匹配内置 String.property.replaceAll 的行为。

- s.remove( start, end )
删除从 start 到 end 的字符（原始字符串的字符，而不是生成的字符串）。两次删除相同内容，或者部分重叠的删除将

- s.reset( start, end )
重置从 start 到 end 的字符（原始字符串的字符，而不是生成的字符串）。可用于恢复先前删除的字符并丢弃不需要的更改。

- s.slice( start, end )
返回对应于原始字符串的 start 到 end 之间的片段的生成字符串内容。如果索引是已删除的字符的索引，则抛出错误。

- s.snip( start, end )
返回一个克隆的 s，其中删除了原始字符串的开始和结束字符之前的所有内容。

- s.toString()
返回生成的字符串。

- s.trim([ charType ])
从开头和结尾修剪与 charType 匹配的内容（默认为 \s，即空白字符）。返回当前实例。

- s.trimStart([ charType ])
从开头修剪与 charType 匹配的内容（默认为 \s，即空白字符）。返回当前实例。

- s.trimEnd([ charType ])
从结尾修剪与 charType 匹配的内容（默认为 \s，即空白字符）。返回当前实例。

- s.trimLines()
从开头和结尾移除空行。返回当前实例。

- s.update( start, end, content[, options] )
用内容替换从 start 到 end 的字符。适用于 s.remove() 相同的限制。返回当前实例。

第四个参数是可选的。它可以有一个 storeName 属性 —— 如果为 true，则原始名称将存储以便稍后包含在源映射的 names 数组中 —— 和一个 overwrite 属性，默认值为 false，确定是否还将覆盖追加/前置到范围中的内容以及原始内容。

- s.update(start, end, content) 等同于 s.overwrite(start, end, content, { contentOnly: true })。

要连接几个源，请使用 MagicString.Bundle：

```javascript
Copy code
const bundle = new MagicString.Bundle();

bundle.addSource({
  filename: 'foo.js',
  content: new MagicString('var answer = 42;')
});

bundle.addSource({
  filename: 'bar.js',
  content: new MagicString('console.log( answer )')
});

// 源可以标记为忽略列表，这提供了一个提示给调试器，
// 不要进入这段代码，也不要根据用户偏好显示源文件。
bundle.addSource({
  filename: 'some-3rdparty-library.js',
  content: new MagicString('function myLib(){}'),
  ignoreList: false // <--
})

// 高级用法：源可以包含一个 `indentExclusionRanges` 属性
// 与 `filename` 和 `content` 并列。这将传递给 `s.indent()`
// - 请参阅上面的文档

bundle.indent() // 可选地，传递一个缩进字符串，否则将被猜测
  .prepend('(function () {\n')
  .append('}());');

bundle.toString();
// (function () {
//   var answer = 42;
//   console.log( answer );
// }());

// 选项与上面的 `s.generateMap()` 相同
const map = bundle.generateMap({
  file: 'bundle.js',
  includeContent: true,
  hires: true
});
```

作为另一种语法，如果你a）没有 filename 或 indentExclusionRanges 选项，或者 b）在使用 new MagicString(...) 时传递了这些选项，你可以简单地传递 MagicString 实例本身：

```javascript

const bundle = new MagicString.Bundle();
const source = new MagicString(someCode, {
  filename: 'foo.js'
});

bundle.addSource(source);
```
