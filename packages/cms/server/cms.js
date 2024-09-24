import { DatabaseSync } from 'node:sqlite'
import { diffChars } from 'diff'
import { generateJSONPatch } from 'generate-json-patch'

export function createCms({ basePath }) {
  const apiPath = `${basePath}/api/`
  const documentListeners = {}
  const richTextInfo = {}
  const database = createDatabase('./cms.db')

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
    console.log('version', version)

    let response = false
    if (category === 'documents') {
      response = handleDocuments(req, res, rest, searchParams)
    }

    if (response)
      return

    res.writeHead(404)
    res.end()
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
            // TODO: does not work for deeper paths
            value: getById({ id })?.[fieldPath],
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
    const fieldPath = searchParams.get('fieldPath')
    withRequestJsonBody(req, (body, error) => {
      // TODO: error handling
      // TODO: the name document is confusing, documents is already used
      console.dir({ body, error }, { depth: 8 })
      const { clientId, steps, version, value } = body
      const { initialValue } = richTextInfo[type][id][fieldPath].info
      if (initialValue.version !== version) {
        return respondJson(res, 400, { success: false, reason: 'Version mismatch' })
      }

      initialValue.value = value
      initialValue.version += steps.length

      sendSteps(type, id, fieldPath, { steps, clientIds: steps.map(_ => clientId) })
      patchDocument(type, id, fieldPath, value, clientId, steps)
      respondJson(res, 200, { success: true })
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
      const { path, value, clientId } = body

      patchDocument(type, id, path, value, clientId)

      res.writeHead(201)
      res.end()
    })

    return true
  }

  function patchDocument(type, id, fieldPath, newValue, clientId, steps = undefined) {
    // TODO: add document version, this allows us to reject changes, this is useful when one person moves something in an array while another edits the contents
    const document = getById({ id })
    const oldValue = document?.[fieldPath]
    if (document) {
      // TODO: does not work for deeper fieldPaths
      document[fieldPath] = newValue
      updateById({ id, document })
    } else {
      const document = { _id: id, _type: type, [fieldPath]: newValue }
      insert({ id, type, document})
    }

    const details = getChangeDetails(oldValue, newValue, steps)

    sendUpdatedDocument(type, id, document)
    sendUpdatedDocuments(type, listDocumentsByType({ type }))
    updateHistory(clientId, id, fieldPath, details)
    sendUpdatedHistory(type, id, listHistoryById({ id }))
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
        }
      }
      : {
        timestampStart: timestamp,
        timestampEnd: timestamp,
        details: newDetails,
      }

    if (details.type === 'string')
      details.difference = diffChars(details.oldValue || '', details.newValue)

    if (details.type === 'object')
      details.patches = getPatches(details.oldValue, details.newValue)

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

  function getChangeDetails(oldValue, newValue, steps = undefined) {
    const baseDetails = { oldValue, newValue, steps }
    if (typeof oldValue === 'string')
      return Object.assign(baseDetails, { type: 'string' })

    if (!oldValue)
      return Object.assign(baseDetails, { type: 'empty' })

    if (!Array.isArray(oldValue) && typeof oldValue !== 'object')
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

  function getById({ id }) {
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
  return database
}

/**
 * @param {import('node:http').IncomingMessage} req
 */
async function withRequestJsonBody(req, callback) {
  const data = []
  req.on('data', chunk => { data.push(chunk) })
  req.on('end', () => {
    try {
      const json = JSON.parse(Buffer.concat(data).toString('utf-8'))
      callback(json)
    } catch (e) {
      callback(null, e)
    }
  })
  req.on('error', e => { callback(null, e) })
}

function getPatches(oldValue, newValue) {
  const patches = generateJSONPatch(oldValue, newValue)
  for (const patch of patches) {
    if (patch.op !== 'replace') {
      console.log(`Unknown operation: ${patch.op}`)
      continue
    }

    const keys = patch.path.slice(1).split('/').filter(Boolean)
    patch['difference'] = diffChars(get(oldValue, keys) || '', get(newValue, keys))
  }
  return patches
}

function respondJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.write(JSON.stringify(body))
  res.end()
}

function get(o, keys) {
  return keys.reduce((result, key) => result[key], o)
}
