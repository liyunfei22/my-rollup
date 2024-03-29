import * as fs from 'node:fs';
import { dirname } from './path.js';

export function mkdirpath ( path ) {
	const dir = dirname( path );
	try {
		fs.readdirSync( dir );
	} catch ( err ) {
		mkdirpath( dir );
		fs.mkdirSync( dir );
	}
}

export function writeFile ( dest, data ) {
	return new Promise( ( fulfil, reject ) => {
		mkdirpath( dest );

		fs.writeFile( dest, data, err => {
			if ( err ) {
				reject( err );
			} else {
				fulfil();
			}
		});
	});
}
export const readdirSync = fs.readdirSync;
export const readFileSync = fs.readFileSync;