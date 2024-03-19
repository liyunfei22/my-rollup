import assert from 'node:assert';
import { isAbsolute, basename } from '../src/utils/path.js';
const absolutePath = '/a/b/c.js';
const relativePath = './a/b/c.js';

describe('path 方法', function () {
  describe('isAbsolute', function () {
    it('isAbsolute', function () {
      assert.equal(isAbsolute(absolutePath), true);
      assert.equal(isAbsolute(relativePath), false);
    });
    it('basename', function () {
      assert.equal(basename(absolutePath), 'c.js');
    });
  });
})

