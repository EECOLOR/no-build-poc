import crypto from 'node:crypto'

/** @import stream from 'node:stream' */
/** @import http from 'node:http' */


/** @typedef {stream.Duplex} WebSocket */

const supportedWebsocketVersion = '13'
/**
 * @arg {http.IncomingMessage} req
 * @arg {WebSocket} socket
 * @arg {NonSharedBuffer} head
 */
export function handleWebSocket(req, socket, head) {
  // TODO: do we need to clear head? If I understand correctly we only need to read socket after the accept has been sent
  if (!req.url.startsWith('/ws'))
    return sendWebsocketNotFoundResponse(socket)

  const { key, isValid, isVersionValid } = validateWebSocketHeaders(req.headers)
  if (!isValid)
    return sendInvalidWebsocketResponse(socket, { isVersionValid })

  sendAcceptWebsocketHeaders(socket, { key })

}

/**
 * @arg {WebSocket} socket
 * @arg {number} statusCode
 * @arg {string} statusMessage
 * @arg {http.OutgoingHttpHeaders} [headers]
 */
function writeHead(socket, statusCode, statusMessage, headers = {}) {
  socket.write(
    `HTTP/1.1 ${statusCode} ${statusMessage}\r\n` +
    Object.entries(headers).map(([k, v]) => `${k}: ${v}\r\n`).join('') +
    `\r\n`
  )
  return socket
}

/** @arg {WebSocket} socket */
function sendWebsocketNotFoundResponse(socket) {
  writeHead(socket, 404, 'Not Found').end()
}

/**
 * @arg {WebSocket} socket
 * @arg {{ key: string }} contexts
 */
function sendAcceptWebsocketHeaders(socket, { key }) {
  writeHead(socket, 101, 'Switching Protocols', {
    upgrade: 'websocket',
    connection: 'Upgrade',
    'sec-websocket-accept': createAcceptValue(key),
  })
}

/**
 * @arg {WebSocket} socket
 * @arg {{ isVersionValid: boolean }} context
 */
function sendInvalidWebsocketResponse(socket, { isVersionValid }) {
  if (!isVersionValid)
    return (
      writeHead(socket, 426, 'Upgrade Required', {
        'sec-websocket-version': supportedWebsocketVersion
      })
      .end()
    )

  writeHead(socket, 400, 'Bad Request').end()
}

/** @arg {string} key */
function createAcceptValue(key) {
  const input = key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
  const hash = crypto.createHash('sha1').update(input).digest('base64')
  return hash
 }

 /** @arg {http.IncomingHttpHeaders} headers */
 function validateWebSocketHeaders(headers) {
  const {
    host,
    upgrade,
    connection,
    'sec-websocket-key': secWebsocketKey,
    'sec-websocket-version': secWebsocketVersion,
    origin,
    'sec-websocket-protocol': secWebsocketProtocol,
    'sec-websocket-extensions': secWebsocketExtensions,
  } = headers

  const isVersionValid = secWebsocketVersion === supportedWebsocketVersion

  const isValid = (
    host &&
    upgrade?.toLowerCase() === 'websocket' &&
    connection?.toLowerCase() === 'upgrade' &&
    secWebsocketKey?.length == 24 && // base64 decoded byte length is allways 16
    isVersionValid
  )

  return {
    isValid,
    isVersionValid,
    possiblyFromBrowser: Boolean(origin),
    protocols: secWebsocketProtocol,
    key: secWebsocketKey,
  }
 }
