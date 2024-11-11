import path from 'node:path'
import fs from 'node:fs'
import { createDatabase, createDatabaseActions } from './database.js'
import { createDocumentsHandler } from './documents.js'
import { createImagesHandler } from './images.js'
import { internalServerError, methodNotAllowed, notAuthorized, notFound } from './machinery/response.js'
import { createStreams } from './machinery/eventStreams.js'
import { routeMap } from '#cms/client/routeMap.js'
import { asRouteChain, match } from '#routing/routeMap.js'
import { createRequestHandlers } from './requestHandlers.js'
import { withAuthInfo } from './machinery/request.js'
import * as google from '#auth/google.js'
import * as microsoft from '#auth/microsoft.js'

const publicKeyProviders = {
  google: google.withPublicKeys,
  microsoft: microsoft.withPublicKeys,
}

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
    // TODO: CSRF token (store in session db, embed in html, pass in header, check header with session) for PATCH, POST, DELETE
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

    const routeChain = asRouteChain(route)

    if (!routeChain.includes(routeMap.api.versioned))
      return handleRoute(req, res, data, { ...params, searchParams })

    return withAuthInfo(req, publicKeyProviders, (auth, error) => {
      // TODO error handling
      if (error) {
        console.error(error)
        return internalServerError(res)
      }

      if (auth.authenticated)
        return handleRoute(req, res, data, { ...params, searchParams, auth })

      // @ts-expect-error I refuse to type info.authenticated === true in the if statement above which would prevent this error
      console.log('Not authorized', auth.hint)
      return notAuthorized(res)
    })
  }

  function handleRoute(req, res, data, info) {
    const { method } = req
    const handlers = data(requestHandlers)
      if (!handlers)
        return notFound(res)

      const handler = handlers[method]
      if (!handler)
        return methodNotAllowed(res)

      return handler(req, res, info)
  }
}
