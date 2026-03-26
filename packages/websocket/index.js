import crypto from 'node:crypto'
import { createWebSocket } from './socket.js'
/** @import stream from 'node:stream' */
/** @import http from 'node:http' */
/** @import { WebSocket } from './socket.js' */

const supportedWebsocketVersion = '13'

/**
 * @arg {{
 *   onConnection(webSocket: WebSocket): void,
 *   onError(webSocket: WebSocket, e: Error): void,
 *   fragmentSize?: number
 * }} configuration
 */
export function createWebSocketServer({ onConnection, onError, fragmentSize }) {
  const sockets = new Set()

  return { handleUpgrade, close }

  /**
   * @arg {http.IncomingMessage} req
   * @arg {stream.Duplex} socket
   * @arg {Buffer} initialBytes
   */
  function handleUpgrade(req, socket, initialBytes) {
    const upgraded = tryToUpgrade(req, socket)
    if (!upgraded)
      return

    sockets.add(socket)
    socket.on('close', () => { sockets.delete(socket) })

    const webSocket = createWebSocket({ socket, initialBytes, fragmentSize })
    socket.on('error', e => { onError(webSocket, e) })
    onConnection(webSocket)
  }

  function close() {
    for (const socket of sockets) {
      socket.end()
    }
  }
}

/**
 * @arg {http.IncomingMessage} req
 * @arg {stream.Duplex} socket
 */
function tryToUpgrade(req, socket) {
  if (!req.url?.startsWith('/ws'))
    return sendWebsocketNotFoundResponse(socket)

  const { key, isValid, isVersionValid } = validateWebSocketHeaders(req.headers)
  if (!isValid)
    return sendInvalidWebsocketResponse(socket, { isVersionValid })

  sendAcceptWebsocketHeaders(socket, { key })

  return true
}

/**
 * @arg {stream.Duplex} socket
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

/** @arg {stream.Duplex} socket */
function sendWebsocketNotFoundResponse(socket) {
  writeHead(socket, 404, 'Not Found').end()
}

/**
 * @arg {stream.Duplex} socket
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
 * @arg {stream.Duplex} socket
 * @arg {{ isVersionValid: boolean }} context
 */
function sendInvalidWebsocketResponse(socket, { isVersionValid }) {
  if (isVersionValid) {
    writeHead(socket, 400, 'Bad Request').end()
  } else {
    writeHead(socket, 426, 'Upgrade Required', {
      'sec-websocket-version': supportedWebsocketVersion
    })
    .end()
  }
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
    isKeyValid(secWebsocketKey) &&
    isVersionValid
  )

  if (!isValid)
    return { isValid, isVersionValid }

  return {
    isValid,
    isVersionValid,
    possiblyFromBrowser: Boolean(origin),
    protocols: secWebsocketProtocol,
    key: secWebsocketKey,
  }
}

/** @arg {string} [key] @returns {key is string} */
function isKeyValid(key) {
  return key?.length === 24 // base64 decoded byte length is allways 16
}
