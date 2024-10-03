import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { render } from '#ui/render/serverRenderer.js'
import { convertClientFiles } from './client-files.js'
import { handleShutdown } from '#utils/shutdown.js'
import { mapAsync } from '#utils/index.js'
import { importFile } from '#dependency-analysis/app.js'

export async function startServer({ indexFiles }) {
  console.log('server starting up')

  const indices = await collectIndices(indexFiles)
  indices.sort((a, b) => b.indexPath.length - a.indexPath.length)

  const staticFileMapping = indices.reduce(
    (result, x) => Object.assign(result, x.staticFileMapping),
    {}
  )

  const server = http.createServer(requestHandler)
  server.listen(8000, () => { console.log('server started at port 8000') })
  server.on('error', e => { console.error(e) })

  handleShutdown(() => {
    console.log('Shutdown detected, closing server')
    server.close(e => { e ? console.error(e) : console.log('Server closed') })
    server.closeAllConnections()
  })

  function requestHandler(req, res) {
    if (req.url.includes('.'))
      return handleStaticFile(req, res)

    const indexInfo = indices.find(x => req.url.startsWith(x.indexPath))
    if (!indexInfo)
      return notFound(res)

    const { IndexComponent, css, importMap, requestHandler } = indexInfo
    const handled = requestHandler?.(req, res)
    if (handled)
      return

    const { result, destroy } = render(IndexComponent({ css, importMap }))
    destroy()
    return serve(res, 200, 'text/html;charset=UTF-8', result)
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

async function collectIndices(indexFiles) {
  const indices = await mapAsync(
    indexFiles,
    async indexFile => {
      console.log('importing index file', indexFile)
      const { imported, cssFiles, clientFiles } = await importFile(indexFile)

      console.log('processing css and client files for', indexFile)
      const { css, importMap, staticFileMapping } =
        await convertClientFiles({ cssFiles, clientFiles })

      const indexPath = path.dirname(indexFile)
      const componentName = path.basename(indexFile, '.js')
      const IndexComponent = imported[componentName]
      const { requestHandler } = imported
      return { indexPath, IndexComponent, css, importMap, requestHandler, staticFileMapping }
    }
  )
  return indices
}
