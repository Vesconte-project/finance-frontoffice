// Webpack loaders are CommonJS; this file runs only in the Playwright fixture build.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ts = require('typescript')
module.exports = function (source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
}
