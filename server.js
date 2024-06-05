import http from 'node:http'
import fs from 'node:fs'
import { parseAndFingerprint, manuallyFingerprinted } from './server/urlToFingerprintedPath.js'
import { cleanup, clientFiles, processedCss } from './magic/bridge.js'
import { IndexHtml } from '/IndexHtml.js'

console.log('server starting up')

const { css, importMap, staticFileMapping } =
  await processLoaderInfo({ processedCss, clientFiles, manuallyFingerprinted })

const server = http.createServer((req, res) => {
  if (req.url.includes('.'))
    return handleStaticFile(req, res)

  return serve(res, 200, 'text/html', IndexHtml({ css, importMap }))
})

server.listen(8000, () => {
  console.log('server started at port 8000')
})

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

function shutdown() {
  console.log('Shutdown detected, initiating cleanup')
  cleanup()
  process.exit(0)
}

function handleStaticFile(req, res) {
  if (!req.url.startsWith('/static/') && !req.url.startsWith('/static_library/'))
    return notFound(res)

  const filePath = staticFileMapping[req.url]

  if (!filePath || !fs.existsSync(filePath))
    return notFound(res)

  return serve(res, 200, determineMimeType(req), fs.readFileSync(filePath))
}

function notFound(res) {
  res.writeHead(404)
  res.end()
}

function serve(res, status, contentType, content) {
  res.writeHead(status, { 'content-type': contentType })
  res.write(content)
  res.end()
}

function determineMimeType(req) {
  return (
    req.url.endsWith('.js') || req.url.endsWith('.mjs') ? 'text/javascript' :
    req.url.endsWith('.css') ? 'text/css' :
    'application/octet-stream'
  )
}

async function processLoaderInfo({ processedCss, clientFiles, manuallyFingerprinted }) {
  const cssLookup = processedCss.reduce(
    (result, x) => {
      result[x.url] = x
      return result
    },
    {}
  )

  const parsedClientFiles = await Promise.all(
    clientFiles.map(async ({ url, specifier }) => ({ url, specifier, parsed: await parseAndFingerprint(url) }))
  )

  // add /static or to support relative imports
  const { css, imports, staticFileMapping } = parsedClientFiles.reduce(
    ({ css, imports, staticFileMapping }, { url, specifier, parsed }) => {
      const { relativePath, fingerprintedPath, isLibrary } = parsed

      if (relativePath.endsWith('.css')) {
        const fingerprintedClassMapPath = `${fingerprintedPath}.js`
        css.push(fingerprintedPath)

        const cssInfo = cssLookup[url]
        staticFileMapping[fingerprintedPath] = cssInfo.modifiedSourcePath
        staticFileMapping[fingerprintedClassMapPath] = cssInfo.classMapAsJsPath

        imports[`/${relativePath}`] = fingerprintedClassMapPath
        imports[`/static/${relativePath}`] = fingerprintedClassMapPath
      }

      if (relativePath.endsWith('.js') || isLibrary) {
        staticFileMapping[fingerprintedPath] = `./${isLibrary ? 'node_modules' : 'src'}/${relativePath}`

        if (!isLibrary || !specifier.startsWith('.'))
          imports[isLibrary ? specifier : `/${relativePath}`] = fingerprintedPath
        imports[`/${isLibrary ? 'static_library' : 'static'}/${relativePath}`] = fingerprintedPath
      }

      return { css, imports, staticFileMapping }
    },
    {
      css: [],
      imports: {},
      staticFileMapping: manuallyFingerprinted,
    }
  )

  // add /static to support relative imports
  Object.entries(imports).forEach(([k, v]) => { imports[`/static${k}`] = v })

  return { css, importMap: { imports }, staticFileMapping }
}
