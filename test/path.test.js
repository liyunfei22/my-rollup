import assert from 'node:assert';
import { isAbsolute, basename } from '../src/utils/path.js';
const absolutePath = '/a/b/c.js';
const relativePath = './a/b/c.js';

describe('path 方法', function () {
  describe.skip('isAbsolute', function () {
    it.skip('isAbsolute', function () {
      assert.equal(isAbsolute(absolutePath), true);
      assert.equal(isAbsolute(relativePath), false);
    });
    it.skip('basename', function () {
      assert.equal(basename(absolutePath), 'c.js');
    });
  });
})

