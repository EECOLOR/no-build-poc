 export function withRequestJsonBody(req, callback) {
  withRequestBufferBody(req, (buffer, e) => {
    let error = e
    let result = null

    if (!error)
      try { result = JSON.parse(buffer.toString('utf-8')) }
      catch (e) { error = e }

    callback(result, error)
  })
}

export function withRequestBufferBody(req, callback) {
  const data = []
  req.on('data', chunk => { data.push(chunk) })
  req.on('end', () => {
    let error = null
    let result = null

    try { result = Buffer.concat(data) }
    catch (e) { error = e }

    callback(result, error)
  })
  req.on('error', e => { callback(null, e) })
}

const emptyObject = {}

export function getCookies(req) {
  const cookieHeader = req.headers['cookie']
  if (!cookieHeader)
    return emptyObject

  const cookies = Object.create(null) // prevent prototype pollution
  for (const cookieSegment of cookieHeader.split(';')) {
    const [encodedName, encodedValue] = cookieSegment.trim().split('=')
    if (!encodedName)
      continue

    cookies[decodeURIComponent(encodedName)] = decodeURIComponent(encodedValue)
  }

  return cookies
}
