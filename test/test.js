import { rollup } from "../src/Rollup.js";

describe('bundle.write()', () => {
  console.log(this);
  it('fails without options or options.dest', function () {
    return rollup({
      entry: 'x',
      plugins: [{
        resolveId: function () { return 'test'; },
        load: function () {
          return 'export var foo = 42;';
        }
      }]
    })
  })
});
