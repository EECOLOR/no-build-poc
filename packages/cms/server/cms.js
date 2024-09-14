export function createCms({ basePath }) {
  const apiPath = `${basePath}/api/`
  const documentListeners = {}
  const pageDocuments = [{ _id: 'a', _type: 'page', title: 'banana' }]

  return {
    canHandleRequest,
    handleRequest
  }

  function canHandleRequest(req) {
    return req.url.startsWith(apiPath)
  }

  function handleRequest(req, res) {
    const [version, category, ...rest] = req.url.replace(apiPath, '').split('/')
    console.log('version', version)

    if (category === 'documents')
      return handleDocuments(req, res, rest)

    res.writeHead(404)
    res.end()
  }

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   * @param {Array<string>} pathSegments
   */
  function handleDocuments(req, res, pathSegments) {
    const [type, id] = pathSegments

    if (id) handleDocument(req, res, { type, id })
    else handleDocumentList(req, res, { type })
  }

  function handleDocumentList(req, res, { type }) {
    const target = getSet(documentListeners, type, 'list')
    addListener(res, target)
    startEventStream(res)

    const documents = [{ _id: 'a', _type: type, title: 'Document A' }]
    sendEvent(res, 'documents', documents)
  }

  function handleDocument(req, res, { type, id }) {
    const target = getSet(documentListeners, type, 'single', id)
    addListener(res, target)
    startEventStream(res)

    const document = { _id: id, _type: type, title: 'Document A' }
    sendEvent(res, 'document', document)
  }

  function sendUpdatedDocuments(documentType, documents) {
    const subscriptions = documentListeners[documentType]
    if (!subscriptions) return
    for (const res of subscriptions) {
      sendEvent(res, 'documents', documents)
    }
  }
}

function startEventStream(res) {
  res.writeHead(200, {
    'X-Accel-Buffering': 'no',
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
  })
}

function addListener(res, target) {
  target.add(res)
  res.addListener('close', _ => { target.delete(res) })
  res.addListener('error', _ => { target.delete(res) })
}

function sendEvent(res, event, data) {
  res.write(
    `event: ${event}\n` +
    `data: ${JSON.stringify(data)}\n` +
    `\n`
  )
}

function getSet(o, ...keys) {
  return keys.reduce(
    (result, key, i) => o[key] || (o[key] = i === keys.length - 1 ? new Set() : {}),
    o
  )
}
