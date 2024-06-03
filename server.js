import http from 'node:http'
import fs from 'node:fs'
import { IndexHtml } from '/IndexHtml.js'
import { getAllFingerprintInfo, getFingerprintInfo } from './magic/fingerprints.js'

const server = http.createServer((req, res) => {
  if (req.url.includes('.'))
    return handleStaticFile(req, res)

  return serve(res, 200, 'text/html', IndexHtml({ css: getCssLinks(), importMap: getImportMap() }))
})

server.listen(8000, () => {
  console.log('server started at port 8000')
})

function handleStaticFile(req, res) {
  if (!req.url.startsWith('/static/'))
    return notFound(res)

  const info = getFingerprintInfo(req.url)

  if (!fs.existsSync(info.filePath))
    return notFound(res)

  return serve(res, 200, determineMimeType(req), fs.readFileSync(info.filePath))
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

function getCssLinks() {
  return getAllFingerprintInfo()
    .map(x => x.fingerprintPath)
    .filter(x => x.endsWith('.css')
  )
}

function getImportMap() {
  const entries = getAllFingerprintInfo()
    .filter(x => !x.excludeFromImportMap)
    .flatMap(x => [
      [`/${x.relativePath}`, x.fingerprintPath],
      [`/static/${x.relativePath}`, x.fingerprintPath], // This is required for relative imports
    ])

  const importMap = { imports: Object.fromEntries(entries) }

  return importMap
}

