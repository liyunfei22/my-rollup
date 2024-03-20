import { blank } from './object.js';
// JavaScript 中的保留字（关键字）
const reservedWords = 'break case class catch const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield enum await implements package protected static interface private public'.split( ' ' );
// JavaScript 中的内置对象、函数
const builtins = 'Infinity NaN undefined null true false eval uneval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent encodeURI encodeURIComponent escape unescape Object Function Boolean Symbol Error EvalError InternalError RangeError ReferenceError SyntaxError TypeError URIError Number Math Date String RegExp Array Int8Array Uint8Array Uint8ClampedArray Int16Array Uint16Array Int32Array Uint32Array Float32Array Float64Array Map Set WeakMap WeakSet SIMD ArrayBuffer DataView JSON Promise Generator GeneratorFunction Reflect Proxy Intl'.split( ' ' );

let blacklisted = blank();
reservedWords.concat( builtins ).forEach( word => blacklisted[ word ] = true );


export default function makeLegalIdentifier ( str ) {
  // 使用正则表达式替换 - 后的字符为大写字母，并将除了字母、数字、$ 和 _ 之外的字符替换为 _。
	str = str
		.replace( /-(\w)/g, ( _, letter ) => letter.toUpperCase() )
		.replace( /[^$_a-zA-Z0-9]/g, '_' );
  // 如果标识符以数字开头或者在 blacklisted 对象中，则在标识符前添加 _。
	if ( /\d/.test( str[0] ) || blacklisted[ str ] ) str = `_${str}`;

	return str;
}
