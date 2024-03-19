// TODO does this all work on windows?
// 用于检查路径是否为绝对路径
export const absolutePath = /^(?:\/|(?:[A-Za-z]:)?[\\|\/])/;

// 是否是绝对路径
export function isAbsolute ( path ) {
	return absolutePath.test( path );
}
// basename
export function basename ( path ) {
	return path.split( /(\/|\\)/ ).pop();
}

export function dirname ( path ) {
	const match = /(\/|\\)[^\/\\]*$/.exec( path );
	if ( !match ) return '.';

	const dir = path.slice( 0, -match[0].length );

	// If `dir` is the empty string, we're at root.
	return dir ? dir : '/';
}

export function extname ( path ) {
	const match = /\.[^\.]+$/.exec( basename( path ) );
	if ( !match ) return '';
	return match[0];
}

export function relative ( from, to ) {
	const fromParts = from.split( /[\/\\]/ ).filter( Boolean );
	const toParts = to.split( /[\/\\]/ ).filter( Boolean );

	while ( fromParts[0] && toParts[0] && fromParts[0] === toParts[0] ) {
		fromParts.shift();
		toParts.shift();
	}

	while ( toParts[0] === '.' || toParts[0] === '..' ) {
		const toPart = toParts.shift();
		if ( toPart === '..' ) {
			fromParts.pop();
		}
	}

	while ( fromParts.pop() ) {
		toParts.unshift( '..' );
	}

	return toParts.join( '/' );
}

export function resolve ( ...paths ) {
	// 将参数列表中的第一个路径出栈，并将其按照斜杠或反斜杠进行分割，然后存储在 resolvedParts 变量中。
	let resolvedParts = paths.shift().split( /[\/\\]/ );

	paths.forEach( path => {
		// 如果当前路径是绝对路径，则直接用该路径替换 resolvedParts 变量，表示从根目录开始解析新路径
		if ( isAbsolute( path ) ) {
			resolvedParts = path.split( /[\/\\]/ );
		} else {
			// 将当前路径按照斜杠或反斜杠进行分割
			const parts = path.split( /[\/\\]/ );
			// 如果路径的开头是 '.' 或 '..'，则进入循环
			while ( parts[0] === '.' || parts[0] === '..' ) {
				// 将路径的第一个部分出栈并存储在 part 变量中
				const part = parts.shift();
				// 如果当前部分是 '..'，则从 resolvedParts 数组中移除最后一个元素，相当于向上一级目录移动
				if ( part === '..' ) {
					resolvedParts.pop();
				}
			}
			// 将剩余部分追加到 resolvedParts 数组中，完成相对路径的解析。
			resolvedParts.push.apply( resolvedParts, parts );
		}
	});
   // 将解析后的路径部分连接起来，并用斜杠分隔。最终返回解析后的完整路径字符串。
	return resolvedParts.join( '/' ); // TODO windows...
}