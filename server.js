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
  if (!req.url.startsWith('/static/'))
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
    req.url.endsWith('.js') ? 'text/javascript' :
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
    clientFiles.map(async ({ url }) => ({ url, parsed: await parseAndFingerprint(url) }))
  )

  const { css, imports, staticFileMapping } = parsedClientFiles.reduce(
    ({ css, imports, staticFileMapping }, { url, parsed }) => {
      const { relativePath, fingerprintedPath } = parsed

      if (relativePath.endsWith('.css')) {
        const fingerprintedClassMapPath = `${fingerprintedPath}.js`
        css.push(fingerprintedPath)

        const cssInfo = cssLookup[url]
        staticFileMapping[fingerprintedPath] = cssInfo.modifiedSourcePath
        staticFileMapping[fingerprintedClassMapPath] = cssInfo.classMapAsJsPath

        imports[`/${relativePath}`] = fingerprintedClassMapPath
      }

      if (relativePath.endsWith('.js')) {
        imports[`/${relativePath}`] = fingerprintedPath

        staticFileMapping[fingerprintedPath] = `./src/${relativePath}`
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
