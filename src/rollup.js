import Bundle from './Bundle.js';

export const VERSION = '<@VERSION@>'
export function rollup(options) {
  if (!options || !options.entry) {
    throw new Error('You must supply options.entry to rollup')
  }
  // 废弃API
  if ( options.transform || options.load || options.resolveId || options.resolveExternal ) {
		throw new Error( 'transform、load、resolveId和resolveexternal选项已被弃用，转而采用统一的插件API' );
	}
  const bundle = new Bundle(options);
  return bundle.build().then(() => {
    console.log('这里')
    return {
      imports: 'imports',
      exports: 'exports',
      modules: 'modules',
      generate: 'generate',
      write: 'write'
    }
  })
}