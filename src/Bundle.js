import ensureArray from './utils/ensureArray.js'
import first from './utils/first.js'
import { load, resolveId, onwarn } from './utils/defaults.js';
import { blank, keys } from './utils/object.js';

export default class Bundle {
  constructor (options) {
    this.entry = options.entry;
    this.entryModule = null;

    this.plugins = ensureArray(options.plugins);
    this.resolveId = first(
      this.plugins.map(plugin => plugin.resolveId)
        .filter(Boolean)
        .concat(resolveId)
    )
    this.load = first(
      this.plugins
        .map(plugin => plugin.load)
        .filter(Boolean)
        .concat(load)
    )

    this.transformers = this.plugins.map( plugin => plugin.transform)
      .filter(Boolean);

    this.pending = blank();
    this.moduleById = blank();
    this.modules = [];

    this.externalModules = [];
    this.internalNamespaces = [];

    this.assumeGlobals = blank();

    this.external = options.external || [];
    this.onwarn = options.onwarn || onwarn;

  }
  build () {
    return Promise.resolve(this.resolveId(this.entry, undefined))
      .then(id => this.fetchModule(id, undefined))
      .then
  }

  fetchModule (id, importer) {
    return Promise.resolve(this.load(id))
      .catch(err => {
        let msg = `不能load ${id}`
        if ( importer ) msg += ` (被 ${importer})加载`;
        msg += `: ${err.message}`;
        throw new Error( msg );
      })
      .then(source => transform(source, id, this.transformers))
      .then(source => {
        const { code, originalCode,  ast, sourceMapChain } = source;
        const module = new Module({id, code, originalCode, ast, sourceMapChain, bundle: this})
        this.modules.push( module );
				this.moduleById[ id ] = module;
        this.fetchAllDependencies( module ).then( () => module )
      })
  }

  fetchAllDependencies ( module ) {
		const promises = module.dependencies.map( source => {
			return Promise.resolve( this.resolveId( source, module.id ) )
				.then( resolvedId => {
					if ( !resolvedId ) {
						if ( !~this.external.indexOf( source ) ) this.onwarn( `Treating '${source}' as external dependency` );
						module.resolvedIds[ source ] = source;

						if ( !this.moduleById[ source ] ) {
							const module = new ExternalModule( source );
							this.externalModules.push( module );
							this.moduleById[ source ] = module;
						}
					}

					else {
						if ( resolvedId === module.id ) {
							throw new Error( `A module cannot import itself (${resolvedId})` );
						}

						module.resolvedIds[ source ] = resolvedId;
						return this.fetchModule( resolvedId, module.id );
					}
				});
		});

		return Promise.all( promises );
	}
}