import * as esbuild from 'esbuild'
import path from 'node:path'
import crypto from 'node:crypto'

const buildContexts = {}

/** @param {Array<string>} files */
export async function extractAllImports(files) {
  const key = getKey(files)
  console.time('build')
  const build = buildContexts[key] || (buildContexts[key] = await esbuild.context(createBuildConfig(files)))
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

function getKey(arrayOfStrings) {
  const uniqueStrings = new Set(arrayOfStrings)
  const sortedStrings = Array.from(uniqueStrings).sort()
  const hash = crypto.createHash('md5')
  for (const x of sortedStrings) hash.update(x)
  return hash.digest('hex')
}
