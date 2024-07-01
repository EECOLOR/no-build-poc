import http from 'node:http'
import fs from 'node:fs'
import { render } from '#ui/render/serverRenderer.js'
import { convertClientFiles } from './client-files.js'
import { app } from '#dependency-analysis/app.js'
import { handleShutdown } from '#utils/child-process.js'

export async function startServer({ IndexComponent }) {
  console.log('server starting up')

  console.log('processing css and client files')
  const { clientFiles, cssFiles } = app
  const { css, importMap, staticFileMapping } =
    await convertClientFiles({ cssFiles, clientFiles })

  const server = http.createServer(requestHandler)
  server.listen(8000, () => { console.log('server started at port 8000') })
  server.on('error', e => { console.error(e) })

  handleShutdown(() => {
    console.log('Shutdown detected, closing server')
    server.close(e => { if (e) console.error(e) })
  })

  function requestHandler(req, res) {
    if (req.url.includes('.'))
      return handleStaticFile(req, res)

    const indexHtml = render(IndexComponent({ css, importMap }))
    return serve(res, 200, 'text/html', indexHtml)
  }

  function handleStaticFile(req, res) {
    if (
      !req.url.startsWith('/static/') &&
      !req.url.startsWith('/static_library/') &&
      !req.url.startsWith('/static_package/')
    ) return notFound(res)

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
}
