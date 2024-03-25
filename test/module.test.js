import { expect } from 'chai';
import Module from '../src/Module.js';


describe('Module', () => {
  it('should correctly add an export', () => {
    const module = new Module({
      id: 'test-module',
      code: 'export default function foo() {}',
      originalCode: 'export default function foo() {}',
      ast: null, // 这里应该是解析后的 AST，但为了测试，我们先设为 null
      sourceMapChain: null, // 同上
      bundle: null, // 同上
    });

    const exportStatement = {
      node: {
        type: 'ExportDefaultDeclaration',
        declaration: {
          type: 'FunctionDeclaration',
          id: {
            name: 'foo'
          }
        }
      }
    };

    module.addExport(exportStatement);

    expect(module.exports.default).to.deep.equal({
      localName: 'default',
      identifier: 'foo'
    });
  });

  it('should handle named exports', () => {
    const module = new Module({
      id: 'test-module',
      code: 'export const bar = 123;',
      originalCode: 'export const bar = 123;',
      ast: null,
      sourceMapChain: null,
      bundle: null,
    });

    const exportStatement = {
      node: {
        type: 'ExportNamedDeclaration',
        specifiers: [
          {
            type: 'ExportNamedSpecifier',
            exported: {
              name: 'bar'
            }
          }
        ]
      }
    };

    module.addExport(exportStatement);

    expect(module.exports).to.haveOwnProperty('bar');
    expect(module.exports.bar.localName).to.equal('bar');
  });
});