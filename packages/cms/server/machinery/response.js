export function respondJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.write(JSON.stringify(body))
  res.end()
}

export function notFound(res) {
  res.writeHead(404).end()
}

export function notAuthorized(res) {
  res.writeHead(401).end()
}

export function methodNotAllowed(res) {
  res.writeHead(405).end()
}

export function sendImage(res, image) {
  res.writeHead(200) // TODO: correct headers
  res.write(image)
  res.end()
}

export function noContent(res) {
  res.writeHead(204, { 'Content-Length': 0, 'Connection': 'close' }).end()
}

export function redirect(res, status, url) {
  res.writeHead(status, { 'Location': url }).end()
}

export const FOUND = 302

export function setCookie(res, name, value) {
  const cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; HttpOnly; SameSite=lax; Path=/` // TODO: ; Secure   and probably a more restrictive path
  const cookies = res.getHeader('Set-Cookie')
  if (cookies)
    cookies.push(cookie)
  else
    res.setHeader('Set-Cookie', [cookie])
}
