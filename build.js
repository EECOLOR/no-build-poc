import * as esbuild from 'esbuild'
import path from 'node:path'

const universalFiles = []
const clientOnlyFiles = []
const cssFiles = []

console.time('server build')
const result = await esbuild.build(createBuildConfig(['./src/IndexHtml.js']))
console.timeEnd('server build')

// create the css files (classNamesAsJs and modifiedSource)
//  - use minify
//  - if you use minify, make sure they are in the same build (different entries is ok) to avoid collision

// bundle the client files (universal and client only)
//  - use a css loader that resolves the classNamesAsJs file
//  - use browser settings
//  // - use import statements for all universal files in a single entry <-- this will probably not work because they are dynamically imported
//  - separate entries for universal, they are loaded runtime by hydration <-- you can experiment with the above version if you can manage to include the hydration file here as well
//  - separate entries for client-only (they are imported / rendered as script tags in the server side code)

// bundle css files
//  - probably best to have a single css file, minified

// generate manifest for node
//  - actual css file(s)
//  - original css file name -> classNameAsJs
//  - original client-only file name -> bundled
//  - import map for universal files -> all to the same bundle or separate dependending on the previous steps

// console.log(result)
// console.log(JSON.stringify(result.metafile.inputs, null, 2))
// console.log(JSON.stringify(result.metafile.outputs, null, 2))
console.log(universalFiles, clientOnlyFiles, cssFiles)

/**
 * @param {Array<string>} entryPoints
 * @returns {import('esbuild').BuildOptions}
 */
function createBuildConfig(entryPoints) {
  console.log('creating build config', entryPoints)
  return {
    entryPoints,
    bundle: true,
    metafile: true,
    write: false,
    platform: /** @type {const} */ ('node'),
    format: /** @type {const} */ ('esm'),
    packages: 'external',
    plugins: [
      {
        name: 'root slash import',
        setup(build) {
          build.onResolve({ filter: /^\// }, args => {
            if (args.kind === 'entry-point') return
            return build.resolve(`.${args.path}`, { kind: args.kind, resolveDir: path.resolve('./src') })
          })
        },
      },
      importCollectorPlugin({
        name: 'universal import',
        filter: /universal\.js$/,
        onImportFound(path) { universalFiles.push(path) }
      }),
      importCollectorPlugin({
        name: 'client only import',
        filter: /client\.js$/,
        onImportFound(path) { clientOnlyFiles.push(path) }
      }),
      importCollectorPlugin({
        name: 'css import',
        filter: /\.css$/,
        onImportFound(path) { cssFiles.push(path )}
      })
    ],
    outdir: 'not_used',
    tsconfigRaw: {},
  }
}

/** @returns {import('esbuild').Plugin} */
function importCollectorPlugin({ name, filter, onImportFound }) {
  return {
    name,
    setup(build) {
      build.onResolve({ filter }, async args => {
        if (args.pluginData?.name === name) return null

        const resolved = await build.resolve(
          args.path,
          { kind: args.kind, resolveDir: args.resolveDir, pluginData: { name } }
        )
        onImportFound(resolved.path)
        return resolved
      })
    }
  }
}
