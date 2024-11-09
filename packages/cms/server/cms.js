import path from 'node:path'
import fs from 'node:fs'
import { createDatabase, createDatabaseActions } from './database.js'
import { createDocumentsHandler } from './documents.js'
import { createImagesHandler } from './images.js'
import { methodNotAllowed, notFound } from './machinery/response.js'
import { createStreams } from './machinery/eventStreams.js'
import { routeMap } from '#cms/client/routeMap.js'
import { match } from '#routing/routeMap.js'
import { createRequestHandlers } from './requestHandlers.js'

export function createCms({ basePath, storagePath }) {
  const imagesPath = path.join(storagePath, 'images')
  if (!fs.existsSync(imagesPath)) fs.mkdirSync(imagesPath)

  const apiPath = `${basePath}/api/`

  const database = createDatabase(path.join(storagePath, './cms.db'))
  const streams = createStreams()
  const databaseActions = createDatabaseActions({ database, streams })

  const documentsHandler = createDocumentsHandler({ databaseActions, streams })
  const imagesHandler = createImagesHandler({ imagesPath, databaseActions })

  const requestHandlers = createRequestHandlers({
    basePath,
    documents: documentsHandler,
    images: imagesHandler,
    streams,
  })

  return {
    canHandleRequest,
    handleRequest,
  }

  function canHandleRequest(req) {
    return req.url.startsWith(apiPath)
  }

  function handleRequest(req, res) {
    // TODO: CSRF token (store in session db, embed in html, pass in header, check header with session)
    const { method } = req
    const { searchParams, pathname } = new URL(`fake://fake.local${req.url}`)

    const info = match(routeMap, pathname.replace(basePath, ''))

    if (!info)
      return notFound(res)

    const { params, route } = info
    if (route === routeMap.notFound)
      return notFound(res)

    const { data } = route
    if (!data)
      return notFound(res)

    const handlers = data(requestHandlers)
    if (!handlers)
      return notFound(res)

    const handler = handlers[method]
    if (!handler)
      return methodNotAllowed(res)

    return handler(req, res, { ...params, searchParams })
  }
}
