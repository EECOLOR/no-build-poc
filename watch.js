import { spawn } from 'node:child_process'
import * as esbuild from 'esbuild'
import path from 'node:path'
import crypto from 'node:crypto'

const builds = {}

const child = spawn(
  'node',
  ['--import', './register-hooks.js', '--watch', '--watch-preserve-output', './server.js'],
  {
    stdio: ['inherit', 'inherit', 'inherit', 'ipc']
  }
)

handleMessage(child, 'custom-resolve:get-dependencies', async clientFiles => {
  const dependencies = await extractAllImports(clientFiles)
  return dependencies
})

async function extractAllImports(clientFiles) {
  const key = getKey(clientFiles)
  console.time('build')
  const build = builds[key] || (builds[key] = await esbuild.context(createBuildConfig(clientFiles)))
  const result = await build.rebuild()
  console.timeEnd('build')
  return collectImports(result.metafile.inputs)
}

function collectImports(inputs) {
  const bookkeeping = {}
  const imports = []
  for (const metadata of Object.values(inputs)) {
    for (const { path: file, original: specifier } of metadata.imports) {
      if (!specifier) continue

      const target = bookkeeping[path] || (bookkeeping[path] = new Set())
      if (target.has(specifier)) continue

      target.add(specifier)
      imports.push(({ specifier, file }))
    }
  }
  return imports
}

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
    platform: /** @type {const} */ ('browser'),
    format: /** @type {const} */ ('esm'),
    plugins: [rootSlashImport],
    outdir: 'not_used',
    tsconfigRaw: {},
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

/** @param {import('node:child_process').ChildProcess} target */
function handleMessage(target, key, handler) {
  target.on('message', message => {
    const content = message[key]
    if (!content) return

    handler(content)
      .then(result => target.send({ [key]: result }))
      .catch(e => console.error(e))
  })
}

function getKey(arrayOfStrings) {
  const uniqueStrings = new Set(arrayOfStrings)
  const sortedStrings = Array.from(uniqueStrings).sort()
  const hash = crypto.createHash('md5')
  for (const x of sortedStrings) hash.update(x)
  return hash.digest('hex')
}
