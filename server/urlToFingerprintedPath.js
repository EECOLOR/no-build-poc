import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { computeFileHash } from './machinery/computeFileHash.js'

// We might not need this if the server just had some rules that determined which files to load based on the url
// on the other hand, this is safer because the server only serves files explicitly added (either through universal or through this method)
export const manuallyFingerprinted = {}

export async function urlToFingerprintedPath(specifier, parentUrl = undefined) {
  const resolvedUrl = await import.meta.resolve(specifier, parentUrl)
  const { fingerprintedPath, relativePath } = await parseAndFingerprint(resolvedUrl)
  manuallyFingerprinted[fingerprintedPath] = `./src/${relativePath}`
  return fingerprintedPath
}

export async function parseAndFingerprint(resolvedUrl) {
  const hash = await computeFileHash(fileURLToPath(resolvedUrl))
  const [bareUrl] = resolvedUrl.split(/[?#]/)
  const { relativePath, isLibrary } = getRelativePath(bareUrl)
  const fingerprintedPath = `/${isLibrary ? 'static_library' : 'static'}/${relativePath.replace(/\.(\w+)$/, `.${hash}.$1`)}`

  return { relativePath, fingerprintedPath, isLibrary }
}

function getRelativePath(url) {
  const relativeToRoot = path.relative('./', fileURLToPath(url))
  const isLibrary = !relativeToRoot.startsWith('src')
  return {
    relativePath: path.relative(isLibrary ? './node_modules' : './src', relativeToRoot),
    isLibrary,
  }
}
