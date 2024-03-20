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
});
console.log(map)

const code = `
function greet(name) {
    console.log('Hello, ' + name + '!');
}
`;

// 创建一个 MagicString 实例，用于处理源代码
const magicString = new MagicString(code);

// 在代码中插入一行注释，并添加源映射位置信息
const insertIndex = code.indexOf('console');
magicString.prependRight(insertIndex, '// This is a comment\n');
magicString.addSourcemapLocation(insertIndex);

// 获取转换后的代码
const transformedCode = magicString.toString();

// 获取源映射
const sourceMap = magicString.generateMap({
    source: 'original.js', // 原始源文件名
    file: 'transformed.js', // 转换后的文件名
    includeContent: true // 是否包含原始源文件内容
});

console.log(transformedCode);
console.log(JSON.stringify(sourceMap, null, 2));