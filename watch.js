import { spawn } from 'node:child_process'
import * as esbuild from 'esbuild'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const builds = {}

const child = spawn(
  'node',
  ['--import', './register-hooks.js', '--watch', './server.js'],
  {
    stdio: ['inherit', 'inherit', 'inherit', 'ipc']
  }
)

child.on('message', message => {
  const content = message['custom-resolve:get-dependencies']
  if (!content) return
  getDependencies(content.url)
    .then(dependencies => child.send({ 'custom-result:get-dependencies': dependencies }))
    .catch(e => console.error(e))
})

async function getDependencies(url) {
  const start = Date.now()
  const build = builds[url] || (builds[url] = await esbuild.context(createBuildConfig(fileURLToPath(url))))
  const result = await build.rebuild()
  const end = Date.now()
  console.log('build time:', end - start)
  const input = path.relative('.', fileURLToPath(url))
  const imports = collectImports(result.metafile.inputs, input)
  return Object.entries(imports).flatMap(
    ([file, specifiers]) => Array.from(specifiers).map(specifier => ({ specifier, file }))
  )
}

function collectImports(inputs, input, result = {}) {
  return inputs[input].imports.reduce(
    (result, { path, original }) => {
      const target = result[path] || (result[path] = new Set())
      target.add(original)
      return collectImports(inputs, path, result)
    },
    result
  )
}

/** @param {string} entryPoint */
function createBuildConfig(entryPoint) {
  console.log('creating build config', entryPoint)
  return {
    entryPoints: [entryPoint],
    bundle: true,
    metafile: true,
    write: false,
    platform: /** @type {const} */ ('browser'),
    format: /** @type {const} */ ('esm'),
    plugins: [rootSlashImport],
    outdir: 'not_used'
  }
}

const rootSlashImport = {
  name: 'root slash import',
  setup(build) {
    build.onResolve({ filter: /^\// }, args => {
      if (args.kind === 'entry-point') return
      return build.resolve(`.${args.path}`, { kind: args.kind, resolveDir: path.resolve('./src') })
    })
  },
}

