import path from 'node:path'
import fs from 'node:fs'
import { createDatabase, createDatabaseActions } from './database.js'
import { createDocumentsHandler } from './documents.js'
import { createImagesHandler } from './images.js'
import { notFound } from './machinery/response.js'

export function createCms({ basePath, storagePath }) {
  const imagesPath = path.join(storagePath, 'images')
  if (!fs.existsSync(imagesPath)) fs.mkdirSync(imagesPath)

  const apiPath = `${basePath}/api/`

  const database = createDatabase(path.join(storagePath, './cms.db'))
  const databaseActions = createDatabaseActions({ database })

  const documentsHandler = createDocumentsHandler({ databaseActions })
  const imagesHandler = createImagesHandler({ imagesPath, databaseActions })

  return {
    canHandleRequest,
    handleRequest
  }

  function canHandleRequest(req) {
    return req.url.startsWith(apiPath)
  }

  function handleRequest(req, res) {
    const { method } = req
    const { searchParams, pathname } = new URL(`fake://fake.local${req.url}`)
    const [version, category, ...pathSegments] = pathname.replace(apiPath, '').split('/')
    console.log('version', version, category, pathSegments.join('/'))


    if (category === 'documents' && documentsHandler.canHandleRequest(method, pathSegments))
      documentsHandler.handleRequest(req, res, pathSegments, searchParams)
    else if (category === 'images' && imagesHandler.canHandleRequest(method, pathSegments))
      imagesHandler.handleRequest(req, res, pathSegments, searchParams)
    else {
      notFound(res)
    }
  }
}
