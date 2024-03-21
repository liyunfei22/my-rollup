import { rollup } from "../src/Rollup.js";

describe('rollup', () => {
  it('fails without options or options.dest', function () {
    const bundle =  rollup({
      entry: 'x',
    })
  })
});
