import ensureArray from './utils/ensureArray.js'
import first from './utils/first.js'

export default class Bundle {
  constructor (options) {
    this.entry = options.entry;
    this.entryModule = null;

    this.plugins = ensureArray(options.plugins);
    this.resolveId = first(
      this.plugins.map(plugin => plugin.resolveId)
        .filter(Boolean)
        .concat(this.resolveId)
    )
    
  }
  build () {
    return Promise.resolve()
  }
}