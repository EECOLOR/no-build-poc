export function respondJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.write(JSON.stringify(body))
  res.end()
}

export function notFound(res) {
  res.writeHead(404)
  res.end()
}

export function sendImage(res, image) {
  res.writeHead(200) // TODO: correct headers
  res.write(image)
  res.end()
}

export function handleSubscription(res, eventStreams, method, connectId, args) {
  if (method === 'HEAD')
    eventStreams.subscribe(connectId, args)
  else if (method === 'DELETE')
    eventStreams.unsubscribe(connectId, args)

  noContent(res)
}

function noContent(res) {
  res.writeHead(204, { 'Content-Length': 0, 'Connection': 'close' })
  res.end()
}
