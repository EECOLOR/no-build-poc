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
