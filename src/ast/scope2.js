import { blank, keys } from '../utils/object.js';

const extractors = {
  Identifier (names, param) {
    names.push(param.name);
  }
}

function extractNames (param) {
  let names = [];
  extractors[ param.type ]( names, param );
  return names;
}

export default class Scope {
  constructor(options) {
    options = options || {};
    this.parent = options.parent;
    this.isBlockScope = !!options.block;
    
    this.declarations = blank();

    if (options.params) {
      options.params.forEach(param => {
        
      })
    }
  }
}