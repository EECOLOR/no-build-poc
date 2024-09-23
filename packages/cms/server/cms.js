import { DatabaseSync } from 'node:sqlite'
import { diffChars } from 'diff'
import { generateJSONPatch } from 'generate-json-patch'
import { Step } from 'prosemirror-transform'
import { Node } from 'prosemirror-model'
import { EditorState } from 'prosemirror-state'

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

  /** @param {import('node:http').IncomingMessage} req */
  function handleGetRichText(req, res, { type, id, searchParams }) {
    const fieldPath = searchParams.get('fieldPath')
    const { listeners, info } = getOrCreate(
      () => ({
        listeners: new Set(),
        info: {
          initialValue: {
            // TODO: does not work for deeper paths
            value: getById({ id })[fieldPath],
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
      patchDocument(type, id, fieldPath, value)
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
      const { path, value, details } = body

      patchDocument(type, id, path, value)

      res.writeHead(201)
      res.end()
    })

    return true
  }

  function patchDocument(type, id, path, value) {
    const document = getById({ id })
    if (document) {
      // TODO: does not work for deeper paths
      const oldValue = document[path]
      document[path] = value

      const patches = getPatches(oldValue, value)
      console.dir(patches, { depth: null })
      updateById({ id, document })
    } else {
      const document = { _id: id, _type: type, [path]: value }
      insert({ id, type, document})
    }
    sendUpdatedDocument(type, id, document)
    sendUpdatedDocuments(type, listDocumentsByType({ type }))
  }

  function sendSteps(documentType, id, fieldPath, steps) {
    const subscriptions = richTextInfo[documentType]?.[id]?.[fieldPath]?.listeners
    if (!subscriptions) return
    for (const res of subscriptions) {
      sendEvent(res, 'steps', steps)
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
    const result = database
      .prepare(`SELECT * FROM documents WHERE type = :type`)
      .all({ type })
    return result.map(x => JSON.parse(x.document))
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
    if (patch.op !== 'replace')
      continue

    const segments = patch.path.slice(1).split('/').filter(Boolean)
    const oldValueAtPath = segments.reduce((result, segment) => result[segment], oldValue)
    const newValueAtPath = segments.reduce((result, segment) => result[segment], newValue)
    patch['details'] = diffChars(oldValueAtPath, newValueAtPath)
  }
  return patches
}

function respondJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.write(JSON.stringify(body))
  res.end()
}
