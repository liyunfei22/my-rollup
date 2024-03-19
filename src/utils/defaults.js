import { readFileSync } from './fs.js';
import { dirname, extname, isAbsolute, resolve } from './path.js';

export function load( id ) {
  return readFileSync(id, 'utf-8');
}

function addExt(id) {
  if ( !extname( id ) ) id += '.js';
	return id;
}

/*
importee: 要解析的导入模块路径。
importer: 导入该模块的模块路径。

**/ 
export function resolveId(importee, importer) {
  //如果 importee 是绝对路径（以斜杠或反斜杠开头），则直接返回带有文件扩展名的路径
  if (isAbsolute(importee)) return addExt(importee);
  // 入口模块 importer为undefined
  if (importer === undefined) return resolve(process.cwd(), addExt(importee));
  // 如果 importee 不以 '.' 开头，意味着它是一个外部模块，不需要解析路径，直接返回 null。
  if ( importee[0] !== '.' ) return null;
  // 使用 dirname(importer) 获取导入者的父目录。
// 将 importee 解析为绝对路径，然后返回它与导入者的父目录的结合，并带有文件扩展名
//   return resolve( dirname( importer ), addExt( importee ) )

}