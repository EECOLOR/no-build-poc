import { fileURLToPath } from 'node:url'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { render } from '#ui/render/serverRenderer.js'
import { handleShutdown } from '#utils/shutdown.js'
import { mapAsync } from '#utils/index.js'

const staticPath = '/static/'
const clientPath = `${staticPath}client/`
const libraryPath = '/static_library/'
const packagePath = '/static_package/'

export async function startServer({ indexFiles, allowedPackages, allowedLibraries }) {
  console.log('server starting up')

  const importMap = createImportMap({ allowedPackages, allowedLibraries })

  const indices = await collectIndices(indexFiles)
  indices.sort((a, b) => b.indexPath.length - a.indexPath.length)

  const server = http.createServer(requestHandler)
  server.listen(8000, () => { console.log('server started at port 8000') })
  server.on('error', e => { console.error(e) })

  handleShutdown(() => {
    console.log('Shutdown detected, closing server')
    server.close(e => { e ? console.error(e) : console.log('Server closed') })
    server.closeAllConnections()
  })

  function requestHandler(req, res) {
    if (req.url.startsWith('/static'))
      return handleStaticFile(req, res)

    const indexInfo = indices.find(x => req.url.startsWith(x.indexPath.slice(7))) // TODO: we are cutting of /server

    if (!indexInfo)
      return notFound(res)

    const { IndexComponent, requestHandler } = indexInfo
    const handlerResult = requestHandler?.(req, res)
    if (handlerResult?.handled)
      return

    const { result, destroy } = render(() => IndexComponent({ importMap }))
    destroy()
    return serve(res, 200, 'text/html;charset=UTF-8', result)
  }

  function handleStaticFile(req, res) {
    const { url } = req

    const filePath = resolveClientUrl(url) || resolvePackageUrl(url) || resolveLibraryUrl(url)

    if (!filePath || !fs.existsSync(filePath))
      return notFound(res)

    return serve(res, 200, determineMimeType(filePath), fs.readFileSync(filePath))
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

  function determineMimeType(filePath) {
    return (
      filePath.endsWith('.js') || filePath.endsWith('.mjs') ? 'text/javascript' :
      filePath.endsWith('.css') ? 'text/css' :
      'application/octet-stream'
    )
  }

  function resolveLibraryUrl(url) {
    if (!url.startsWith(libraryPath))
      return

    const specifier = url.slice(libraryPath.length)
    if (!allowedLibraries.some(x => specifier.startsWith(x))) // TODO: this still allows for unlisted packages, if we allow 'xyz' you could still het 'xyz-abc'
      return

    return resolveLibraryPath(specifier)
  }

  function resolvePackageUrl(url) {
    if (!url.startsWith(packagePath))
      return

    const specifier = url.slice(packagePath.length)
    if (!allowedPackages.some(x => specifier.startsWith(x.slice(1)))) // TODO: this still allows for unlisted packages, if we allow 'xyz' you could still het 'xyz-abc'
      return

    return fileURLToPath(import.meta.resolve(`#${specifier}`))
  }

  function resolveClientUrl(url) {
    if (!url.startsWith(clientPath))
      return

    const specifier = url.slice(clientPath.length)
    return fileURLToPath(import.meta.resolve(`/client/${specifier}`))
  }
}

function createImportMap({ allowedLibraries, allowedPackages }) {
  return {
    imports: {
      '/': staticPath,
      [staticPath]: staticPath,
      [libraryPath]: libraryPath,
      [packagePath]: packagePath,
      ...Object.fromEntries(
        allowedPackages.flatMap(name => [
          [name, `${packagePath}${name.slice(1)}`],
          [`${name}/`, `${packagePath}${name.slice(1)}/`],
        ])
      ),
      ...Object.fromEntries(
        allowedLibraries.flatMap(name => [
          [name, `${libraryPath}${resolveRelativeLibraryPath(name)}`],
          [`${name}/`, `${libraryPath}${name}/`],
        ])
      )
    }
  }
}

function resolveRelativeLibraryPath(specifier) {
  const libraryPath = resolveLibraryPath(specifier)
  return path.relative('./node_modules', libraryPath)
}

function resolveLibraryPath(specifier) {
  const fullPath = path.resolve(path.join('./node_modules', specifier))
  const stats = fs.lstatSync(fullPath, { throwIfNoEntry: false })
  if (stats?.isFile())
    return fullPath

  return fileURLToPath(import.meta.resolve(`${specifier}#browser`))
}

async function collectIndices(indexFiles) {
  return mapAsync(indexFiles, async indexFile => {
      console.log('importing index file', indexFile)
      const imported = await import(indexFile)

      return {
        indexPath: path.dirname(indexFile),
        IndexComponent: imported[path.basename(indexFile, '.js')],
        requestHandler: imported.requestHandler,
      }
    }
  )
}
