export function respondJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.write(JSON.stringify(body))
  res.end()
}

export function notFound(res) {
  res.writeHead(404)
  res.end()
}

export function methodNotAllowed(res) {
  res.writeHead(405)
  res.end()
}

export function sendImage(res, image) {
  res.writeHead(200) // TODO: correct headers
  res.write(image)
  res.end()
}

export function noContent(res) {
  res.writeHead(204, { 'Content-Length': 0, 'Connection': 'close' })
  res.end()
}

export function redirect(res, status, url) {
  res.writeHead(status, { 'Location': url })
  res.end()
}

export const FOUND = 302
