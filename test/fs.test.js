import { mkdirpath } from '../src/utils/fs.js' 
describe('fs', function() {
  it('mkdirpath', function() {
    mkdirpath('/a/b')
  } )
})