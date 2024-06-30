import http from 'node:http'
import fs from 'node:fs'
import { cleanup, clientFiles, processedCss } from '../magic/bridge.js'
import { IndexHtml } from '/IndexHtml.js'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { render } from '/machinery/serverRenderer.js'
import { setupParentProcessCommunication } from '../magic/child-process.js'

const parent = setupParentProcessCommunication({
  'getDependencies': 'custom-resolve:get-dependencies',
})

const { css, importMap, staticFileMapping } =
  await processLoaderInfo({ processedCss, clientFiles })

const server = http.createServer((req, res) => {
  if (req.url.includes('.'))
    return handleStaticFile(req, res)

  const indexHtml = render(IndexHtml({ css, importMap }))
  return serve(res, 200, 'text/html', indexHtml)
})

console.log('server starting up')
server.listen(8000, () => {
  console.log('server started at port 8000')
})
server.on('error', e => {
  console.error(e)
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

async function processLoaderInfo({ processedCss, clientFiles }) {
  const allClientFiles = await resolveAllClientFiles(clientFiles)

  const cssLookup = processedCss.reduce(
    (result, x) => {
      result[x.url] = x
      return result
    },
    {}
  )

  const parsedClientFiles = await Promise.all(
    allClientFiles.map(
      async ({ url, specifier }) => ({ url, specifier, parsed: getPathInformation(url) })
    )
  )

  // add /static or to support relative imports
  const { css, imports, staticFileMapping } = parsedClientFiles.reduce(
    ({ css, imports, staticFileMapping }, { url, specifier, parsed }) => {
      const { relativePath, publicPath, isLibrary, relativeToRootPath } = parsed

      if (relativePath.endsWith('.css')) {
        css.push(publicPath)

        const publicClassMapPath = `${publicPath}.js`

        const cssInfo = cssLookup[url]
        staticFileMapping[publicPath] = cssInfo.modifiedSourcePath
        staticFileMapping[publicClassMapPath] = cssInfo.classMapAsJsPath

        imports[publicPath] = publicClassMapPath
      }

      if (relativePath.endsWith('.js') || isLibrary) {
        staticFileMapping[publicPath] = relativeToRootPath

        if (isLibrary && !specifier.startsWith('.'))
          imports[specifier] = publicPath
      }

      return { css, imports, staticFileMapping }
    },
    {
      css: [],
      imports: {
        '/': '/static/',
        '/static/': '/static/',
        '/static_library/': '/static_library/'
      },
      staticFileMapping: {},
    }
  )

  return { css, importMap: { imports }, staticFileMapping }
}

function getPathInformation(url) {
  const [bareUrl] = url.split(/[?#]/)
  const relativeToRootPath = path.relative('./', fileURLToPath(bareUrl))
  const isLibrary = !relativeToRootPath.startsWith('src')
  const relativePath = path.relative(isLibrary ? './node_modules' : './src', relativeToRootPath)
  return {
    isLibrary,
    relativePath,
    relativeToRootPath,
    publicPath: `/${isLibrary ? 'static_library' : 'static'}/${relativePath}`,
  }
}

async function resolveAllClientFiles(clientFiles) {
  let allClientFiles = clientFiles.slice()

  const dependencies = await parent.getDependencies(clientFiles.map(x => fileURLToPath(x.url)))

  dependencies.forEach(({ file, specifier }) => {
    const url = pathToFileURL(path.resolve(file)).href
    allClientFiles.push({ url, specifier })
  })

  return allClientFiles
}
