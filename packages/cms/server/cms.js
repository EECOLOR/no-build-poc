import { DatabaseSync } from 'node:sqlite'
import { diffChars } from 'diff'
import path from 'node:path'
import sharp from 'sharp'
import fs from 'node:fs'

export function createCms({ basePath, storagePath }) {
  const imagesPath = path.join(storagePath, 'images')
  if (!fs.existsSync(imagesPath)) fs.mkdirSync(imagesPath)

  const apiPath = `${basePath}/api/`
  const documentListeners = {}
  const richTextInfo = {}
  const imageListeners = {}
  const database = createDatabase(path.join(storagePath, './cms.db'))

  return {
    canHandleRequest,
    handleRequest
  }

  function canHandleRequest(req) {
    return req.url.startsWith(apiPath)
  }

  function handleRequest(req, res) {
    const { searchParams, pathname } = new URL(`fake://fake.local${req.url}`)
    const [version, category, ...rest] = pathname.replace(apiPath, '').split('/')
    console.log('version', version, category, rest.join('/'))

    let response = false
    if (category === 'documents') {
      response = handleDocuments(req, res, rest, searchParams)
    }

    if (category === 'images') {
      response = handleImages(req, res, rest, searchParams)
    }

    if (response)
      return

    res.writeHead(404)
    res.end()
  }

  function handleImages(req, res, pathSegments, searchParams) {
    const [filename, feature] = pathSegments

    if (req.method === 'GET') {
      if (filename && feature === 'metadata')
        return handleGetImageMetadata(req, res, { filename })
      else
        return filename
          ? handleGetImage(req, res, { filename, searchParams })
          : handleListImages(req, res)
    }

    if (req.method === 'POST')
      return handlePostImage(req, res, { searchParams })

    if (req.method === 'PATCH')
      if (filename && feature === 'metadata')
        return handlePatchImageMtadata(req, res, { filename })

    return false
  }

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  function handleGetImageMetadata(req, res, { filename }) {
    const target = getOrCreate(newSet, imageListeners, 'metadata', filename)
    addListener(res, target)
    startEventStream(res)

    const metadata = getImageMetadataByFilename({ filename })
    sendEvent(res, 'metadata', metadata)
    return true
  }

  function handlePatchImageMtadata(req, res, { filename }) {
    withRequestJsonBody(req, (body, error) => {
      // TODO: error handling
      // TODO: history
      const existingMetadata = getImageMetadataByFilename({ filename })
      const metadata = Object.assign(existingMetadata, body)

      updateImageMetadataByFilename({ filename, metadata })
      sendUpdatedImageMetadata(filename, metadata)
      respondJson(res, 200, { success: true })
    })

    return true
  }

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  function handleListImages(req, res) {
    const target = getOrCreate(newSet, imageListeners, 'list')
    addListener(res, target)
    startEventStream(res)

    const images = listImages()
    sendEvent(res, 'images', images)
    return true
  }

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   * @param {{ filename: string, searchParams: URLSearchParams }} options
   */
  function handleGetImage(req, res, { filename, searchParams }) {
    const imagePath = path.join(imagesPath, filename)
    if (!fs.existsSync(imagePath))
      return false

    const image = fs.readFileSync(imagePath)

    const entries = Array.from(searchParams.entries())
    if (!entries.length) {
      res.writeHead(200)
      res.write(image)
      res.end()
      return true
    }

    const params = Object.fromEntries(entries)

    // TODO: error responses
    res.writeHead(200)
    handleModifiedImage(image, params)
      .then(x => {
        console.log(x.info)
        res.write(x.data)
      })
      .catch(e => console.error(e))
      .then(_ => {
        res.end()
      })

    return true
  }

  async function handleModifiedImage(image, params) {
    if (!params.w || !params.h)
      throw new Error(`Expected w and h params`)

    const $image = sharp(image)
    const metadata = await $image.metadata()
    console.log(params)

    const width = parseInt(params.w, 10)
    const height = parseInt(params.h, 10)
    const crop = params.crop
      ? rectangleFromArray(params.crop?.split(','))
      : { x: 0, y: 0, width: metadata.width, height: metadata.height }
    const hotspot = params.hotspot
      ? rectangleFromArray(params.hotspot.split(','))
      : crop
    const region = determineImageRegion(crop, hotspot, width / height)

    return $image
      .extract({ left: region.x, top: region.y, width: region.width, height: region.height })
      .resize({ width, height })
      .toBuffer({ resolveWithObject: true })
  }

  function rectangleFromArray(array) {
    const [x, y, width, height] = array.map(x => parseInt(x, 10))
    return { x, y, width, height }
  }

  function determineImageRegion(crop, hotspot, desiredRatio) {
    const cropCenterX = crop.x + crop.width / 2
    const cropCenterY = crop.y + crop.height / 2

    let width, height
    if (crop.width / crop.height > desiredRatio) {
      height = crop.height
      width = height * desiredRatio
    } else {
      width = crop.width
      height = width / desiredRatio
    }

    const hotspotRight = hotspot.x + hotspot.width
    const hotspotBottom = hotspot.y + hotspot.height

    let x = cropCenterX - width / 2
    let y = cropCenterY - height / 2
    if (hotspot.x < x) {
        x = Math.max(crop.x, hotspot.x)
    } else if (hotspotRight > x + width) {
        x = Math.min(crop.x + crop.width - width, hotspotRight - width)
    }
    if (hotspot.y < y) {
        y = Math.max(crop.y, hotspot.y)
    } else if (hotspotBottom > y + height) {
        y = Math.min(crop.y + crop.height - height, hotspotBottom - height)
    }

    x = clamp(crop.x, crop.x + crop.width - width, x)
    y = clamp(crop.y, crop.y + crop.height - height, y)

    return rectangleFromArray([x, y, width, height].map(n => Math.round(n)))

    function clamp(min, max, value) {
        return Math.max(min, Math.min(max, value))
    }
  }

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  function handlePostImage(req, res, { searchParams }) {
    withRequestBufferBody(req, async (buffer, e) => {
      // TODO: error handling
      // TODO: scan for virus
      const $image = sharp(buffer)

      const { width, height } = await $image.metadata()
      const newName = `${crypto.randomUUID()}-${width}x${height}.webp`
      const newBuffer = await $image.webp().toBuffer()
      fs.writeFileSync(path.join(imagesPath, newName), newBuffer)

      const fileInfo = {
        filename: newName,
        metadata: {
          width,
          height,
          originalFilename: searchParams.name
        }
      }

      database
        .prepare(`
          INSERT INTO images (filename, metadata)
          VALUES (:filename, :metadata)
        `)
        // TODO: user metadata
        .run({ filename: fileInfo.filename, metadata: JSON.stringify(fileInfo.metadata) })

      respondJson(res, 200, fileInfo)

      sendUpdatedImageMetadata(fileInfo.filename, fileInfo.metadata)
      sendUpdatedImages(listImages())
    })

    return true
  }

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   * @param {Array<string>} pathSegments
   */
  function handleDocuments(req, res, pathSegments, searchParams) {
    const [type, id, feature] = pathSegments

    if (feature === 'history')
      return (
        req.method === 'GET' ? handleGetHistory(req, res, { type, id }) :
        false
      )

    if (feature === 'rich-text')
      return (
        req.method === 'GET' ? handleGetRichText(req, res, { type, id, searchParams }) :
        req.method === 'POST' ? handlePostRichText(req, res, { type, id, searchParams }) :
        false
      )

    if (req.method === 'GET')
      return id
        ? handleGetDocument(req, res, { type, id })
        : handleGetDocumentList(req, res, { type })

    if (id && req.method === 'PATCH')
      return handlePatchDocument(req, res, { type, id })

    return false
  }

  function handleGetHistory(req, res, { type, id }) {
    const target = getOrCreate(newSet, documentListeners, type, 'history', id)
    addListener(res, target)
    startEventStream(res)

    const history = listHistoryById({ id })
    sendEvent(res, 'history', history)
    return true
  }

  function handleGetRichText(req, res, { type, id, searchParams }) {
    const fieldPath = searchParams.get('fieldPath')
    const { listeners, info } = getOrCreate(
      () => ({
        listeners: new Set(),
        info: {
          initialValue: {
            value: get(getById({ id }), fieldPath),
            version: 0,
          },
        }
      }),
      richTextInfo, type, id, fieldPath
    )

    addListener(res, listeners, function cleanup() {
      delete richTextInfo[type][id][fieldPath]
    })
    startEventStream(res)

    sendEvent(res, 'initialValue', info.initialValue)
    return true
  }

  /** @param {import('node:http').ServerResponse} res */
  function handlePostRichText(req, res, { type, id, searchParams }) {
    const path = searchParams.get('fieldPath')
    withRequestJsonBody(req, (body, error) => {
      // TODO: error handling
      const { clientId, steps, documentVersion, valueVersion, value } = body
      const { initialValue } = richTextInfo[type][id][path].info
      if (initialValue.version !== valueVersion)
        return respondJson(res, 400, { success: false, reason: 'Version mismatch' })

      initialValue.value = value
      initialValue.version += steps.length

      const patch = { op: 'replace', path, value }
      const result = patchDocument(type, id, documentVersion, patch, clientId, steps)

      if (!result.success)
        return respondJson(res, 400, result)

      sendSteps(type, id, path, { steps, clientIds: steps.map(_ => clientId) })
      respondJson(res, 200, result)
    })

    return true
  }

  function handleGetDocumentList(req, res, { type }) {
    const target = getOrCreate(newSet, documentListeners, type, 'list')
    addListener(res, target)
    startEventStream(res)

    const documents = listDocumentsByType({ type })
    sendEvent(res, 'documents', documents)
    return true
  }

  function handleGetDocument(req, res, { type, id }) {
    const target = getOrCreate(newSet, documentListeners, type, 'single', id)
    addListener(res, target)
    startEventStream(res)

    const document = getById({ id })
    sendEvent(res, 'document', document)
    return true
  }

  function handlePatchDocument(req, res, { type, id }) {
    withRequestJsonBody(req, (body, error) => {
      // TODO: error handling
      console.dir({ body, error }, { depth: 8 })
      const { version, patch, clientId } = body

      const result = patchDocument(type, id, version, patch, clientId)

      respondJson(res, result.success ? 200 : 400, result)
    })

    return true
  }

  function patchDocument(type, id, version, patch, clientId, steps = undefined) {
    const documentFromDatabase = getById({ id })
    const isUpdate = Boolean(documentFromDatabase)
    const document = documentFromDatabase || { _id: id, _type: type, version: 0 }

    const expectedVersion = document.version ?? 0
    if (version !== expectedVersion)
      return {
        success: false,
        message: `Incompatible document version, expeced version ${expectedVersion}`
      }

    if (patch.path === '') {
      if (patch.op !== 'remove')
        return { success: false, message: `Only valid patch operation on document is 'remove', got '${patch.op}'` }

      deleteById({ id })
      updateHistory(clientId, id, '', { oldValue: document, newValue: null })
      sendUpdatedDocument(type, id, null)
      sendUpdatedDocuments(type, listDocumentsByType({ type }))
      return { success: true }
    }
    // if path === '', we are talking about the document, in which case we need to handle it differently

    const operations = {
      // Not rfc6902 (JSON patch) compliant, doesn't do any checking
      replace({ path, value }) {
        setAt(document, path, value)
      },
      move({ from, path }) {
        const removed = operations.remove({ path: from })
        setAt(document, path, removed, { insertIfArray: true })
      },
      remove({ path }) {
        return deleteAt(document, path)
      },
    }
    const applyPatch = operations[patch.op]
    if (!applyPatch)
      throw new Error(`Operation '${patch.op}' not implmented`)

    const oldValue = get(document, patch.from || patch.path)
    applyPatch(patch)
    document.version = (document.version ?? 0) + 1

    if (isUpdate) updateById({ id, document })
    else insert({ id, type, document})

    const newValue = get(document, patch.path)

    sendUpdatedDocument(type, id, document)
    sendUpdatedDocuments(type, listDocumentsByType({ type }))

    const details = getChangeDetails([patch], oldValue, newValue, steps)
    updateHistory(clientId, id, patch.path, details)
    sendUpdatedHistory(type, id, listHistoryById({ id }))

    return { success: true }
  }

  function updateHistory(clientId, documentId, fieldPath, newDetails) {
    const timestamp = Date.now()

    /** @type {any} */
    let result = database
      .prepare(`
        SELECT timestampStart, details, fieldPath
        FROM history
        WHERE documentId = :documentId
        AND clientId = :clientId
        AND timestampEnd > :timestamp - 60000
        ORDER BY timestampEnd DESC
        LIMIT 1
      `)
      .get({ documentId, clientId, timestamp })

    if (result && result.fieldPath !== fieldPath)
      result = null

    const previous = result && JSON.parse(result.details)
    const { timestampStart, timestampEnd, details } = result
      ? {
        timestampStart: result.timestampStart,
        timestampEnd: timestamp,
        details: {
          type: newDetails.type,
          oldValue: previous.oldValue,
          newValue: newDetails.newValue,
          steps: newDetails.steps && previous.steps.concat(newDetails.steps),
          patches: newDetails.patches && previous.patches.concat(newDetails.patches),
        }
      }
      : {
        timestampStart: timestamp,
        timestampEnd: timestamp,
        details: newDetails,
      }

    if (details.type === 'string')
      details.difference = diffChars(details.oldValue || '', details.newValue)

    if (result) {
      //TODO: if the old and new value end up to be the same (or in case of an object, when there are no patches) remove the history item
      return database
        .prepare(`
          UPDATE history
          SET
            timestampEnd = :timestampEnd,
            details = :details
          WHERE documentId = :documentId
          AND fieldPath = :fieldPath
          AND clientId = :clientId
          AND timestampStart = :timestampStart
        `)
        .run({ documentId, fieldPath, clientId, timestampStart, timestampEnd, details: JSON.stringify(details) })
    } else {
      return database
        .prepare(`
          INSERT INTO history (documentId, fieldPath, clientId, timestampStart, timestampEnd, details)
          VALUES (:documentId, :fieldPath, :clientId, :timestampStart, :timestampEnd, :details)
        `)
        .run({ documentId, fieldPath, clientId, timestampStart, timestampEnd, details: JSON.stringify(details) })
    }
  }

  function getChangeDetails(patches, oldValue, newValue, steps = undefined) {
    const baseDetails = { patches, oldValue, newValue, steps }
    const valueForType = oldValue ?? newValue

    if (typeof valueForType === 'string')
      return Object.assign(baseDetails, { type: 'string' })

    if (!valueForType)
      return Object.assign(baseDetails, { type: 'empty' })

    if (!Array.isArray(valueForType) && typeof valueForType !== 'object')
      return Object.assign(baseDetails, { type: 'primitive' })

    return Object.assign(baseDetails, { type: 'object' })
  }

  function sendSteps(documentType, id, fieldPath, steps) {
    const subscriptions = richTextInfo[documentType]?.[id]?.[fieldPath]?.listeners
    if (!subscriptions) return
    for (const res of subscriptions) {
      sendEvent(res, 'steps', steps)
    }
  }

  function sendUpdatedHistory(documentType, id, history) {
    const subscriptions = documentListeners[documentType]?.history?.[id]
    if (!subscriptions) return
    for (const res of subscriptions) {
      sendEvent(res, 'history', history)
    }
  }

  function sendUpdatedDocuments(documentType, documents) {
    const subscriptions = documentListeners[documentType]?.list
    if (!subscriptions) return
    for (const res of subscriptions) {
      sendEvent(res, 'documents', documents)
    }
  }

  function sendUpdatedDocument(documentType, id, document) {
    const subscriptions = documentListeners[documentType]?.single?.[id]
    if (!subscriptions) return
    for (const res of subscriptions) {
      sendEvent(res, 'document', document)
    }
  }

  function sendUpdatedImages(images) {
    const subscriptions = imageListeners.list
    if (!subscriptions) return
    for (const res of subscriptions) {
      sendEvent(res, 'images', images)
    }
  }

  function sendUpdatedImageMetadata(filename, metadata) {
    const subscriptions = imageListeners.metadata?.[filename]
    if (!subscriptions) return
    for (const res of subscriptions) {
      sendEvent(res, 'metadata', metadata)
    }
  }

  function getById({ id }) {
    /** @type {any} */
    const result = database
      .prepare(`SELECT * FROM documents WHERE id = :id`)
      .get({ id })

    if (!result)
      return null

    const { document } = result
    return JSON.parse(document)
  }
  function updateById({ id, document }) {
    return database
      .prepare(`UPDATE documents SET document = :document WHERE id = :id`)
      .run({ id, document: JSON.stringify(document) })
  }
  function deleteById({ id }) {
    return database
      .prepare(`DELETE FROM documents WHERE id = :id`)
      .run({ id })
  }
  function insert({ id, type, document }) {
    return database
      .prepare(`INSERT INTO documents (id, type, document) VALUES (:id, :type, :document)`)
      .run({ id, type, document: JSON.stringify(document)})
  }
  function listDocumentsByType({ type }) {
    /** @type {any} */
    const result = database
      .prepare(`SELECT * FROM documents WHERE type = :type`)
      .all({ type })
    return result.map(x => JSON.parse(x.document))
  }
  function listHistoryById({ id }) {
    /** @type {any} */
    const result = database
      .prepare(`
        SELECT fieldPath, clientId, timestampStart, timestampEnd, details
        FROM history
        WHERE documentId = :documentId
        ORDER BY timestampStart DESC
      `)
      .all({ documentId: id })
    return result.map(x => ({
      fieldPath: x.fieldPath,
      clientId: x.clientId,
      timestampStart: x.timestampStart,
      timestampEnd: x.timestampEnd,
      details: JSON.parse(x.details),
    }))
  }
  function listImages() {
    /** @type {any} */
    const result = database
      .prepare(`SELECT * FROM images`)
      .all()
    return result.map(x => ({ ...x, metadata: JSON.parse(x.metadata) }))
  }
  function getImageMetadataByFilename({ filename }) {
    /** @type {any} */
    const result = database
      .prepare(`SELECT * FROM images WHERE filename = :filename`)
      .get({ filename })

    if (!result)
      return null

    const { metadata } = result
    return JSON.parse(metadata)
  }
  function updateImageMetadataByFilename({ filename, metadata }) {
    return database
      .prepare(`UPDATE images SET metadata = :metadata WHERE filename = :filename`)
      .run({ filename, metadata: JSON.stringify(metadata) })
  }
}

function startEventStream(res) {
  res.writeHead(200, {
    'X-Accel-Buffering': 'no',
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
  })
}

function addListener(res, target, cleanup = undefined) {
  target.add(res)
  res.addListener('close', remove)
  res.addListener('error', remove)

  function remove() {
    target.delete(res)
    if (cleanup && !target.size) cleanup()
  }
}

function sendEvent(res, event, data) {
  res.write(
    `event: ${event}\n` +
    `data: ${JSON.stringify(data)}\n` +
    `\n`
  )
}

function newSet() {
  return new Set()
}

function getOrCreate(createValue, o, ...keys) {
  return keys.reduce(
    (result, key, i) => result[key] || (result[key] = i === keys.length - 1 ? createValue() : {}),
    o
  )
}

function createDatabase(file) {
  const database = new DatabaseSync(file)
  // database.exec(`DROP TABLE documents`)
  database.exec(
    `CREATE TABLE IF NOT EXISTS documents (
      id BLOB PRIMARY KEY,
      type BLOB NOT NULL,
      document TEXT NOT NULL
    )`
  )
  // database.exec(`DROP TABLE history`)
  database.exec( // TODO: foreign key to documents
  `CREATE TABLE IF NOT EXISTS history (
    documentId BLOB NOT NULL,
    fieldPath TEXT NOT NULL,
    clientId TEXT NOT NULL,
    timestampStart NUMERIC NOT NULL,
    timestampEnd NUMERIC NOT NULL,
    details TEXT NOT NULL,
    PRIMARY KEY (documentId, clientId, fieldPath, timestampStart)
    )`
  )

  // database.exec(`DROP TABLE images`)
  database.exec(
    `CREATE TABLE IF NOT EXISTS images (
      filename BLOB NOT NULL,
      metadata TEXT NOT NULL,
      PRIMARY KEY (filename)
    )`
  )
  return database
}

/**
 * @param {import('node:http').IncomingMessage} req
 */
async function withRequestJsonBody(req, callback) {
  withRequestBufferBody(req, (buffer, e) => {
    if (e) return callback(null, e)
    try {
      callback(JSON.parse(buffer.toString('utf-8')), null)
    } catch (e) {
      callback(null, e)
    }
  })
}

async function withRequestBufferBody(req, callback) {
  const data = []
  req.on('data', chunk => { data.push(chunk) })
  req.on('end', () => {
    try {
      callback(Buffer.concat(data), null)
    } catch (e) {
      callback(null, e)
    }
  })
  req.on('error', e => { callback(null, e) })
}

function respondJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.write(JSON.stringify(body))
  res.end()
}

function get(o, path) {
  return getKeys(path).reduce((result, key) => result && result[key], o)
}

function setAt(o, path, value, { insertIfArray = false } = {}) {
  const keys = getKeys(path)
  let target = o
  for (const [i, key] of keys.entries()) {
    const isLast = i === keys.length - 1
    if (isLast) {
      if (insertIfArray && isNumber(key)) target.splice(key, 0, value)
      else target[key] = value
      return
    }

    if (target[key]) {
      target = target[key]
      continue
    }

    const nextKey = keys[i + 1]
    target = target[key] = isNumber(nextKey) ? [] : {}
  }
}

function isNumber(x) {
  return !Number.isNaN(Number(x))
}

function deleteAt(o, path) {
  const keys = getKeys(path)
  return keys.reduce(
    (result, key, i) => {
      const isLast = i === keys.length - 1

      if (isLast && result) {
        const value = result[key]
        if (Array.isArray(result)) result.splice(key, 1)
        else delete result[key]
        return value
      }

      return result && result[key]
    },
    o
  )
}

function getKeys(path) {
  return path.split('/').filter(Boolean)
}
