const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Load production TypeScript with explicit native adapters in Node.
module.exports = function createLoader(mocks = {}) {
  const cache = new Map();
  const load = file => {
    const absolute = path.resolve(__dirname, '..', file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = { exports: {} };
    cache.set(absolute, module);
    const compiled = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const localRequire = id => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith('.')) return load(path.resolve(path.dirname(absolute), `${id}.ts`));
      return require(id);
    };
    vm.runInThisContext(`(function(require, module, exports) {${compiled}\n})`, { filename: absolute })(localRequire, module, module.exports);
    return module.exports;
  };
  return load;
};
