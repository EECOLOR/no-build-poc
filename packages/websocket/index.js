import crypto from 'node:crypto'
import { asConst } from '#typescript/helpers.js'
import { TransformStream } from 'node:stream/web'

/** @import { ReadableStream, WritableStreamDefaultWriter } from 'node:stream/web' */
/** @import stream from 'node:stream' */
/** @import http from 'node:http' */
/** @import { UnionOf, Subtract } from '#typescript/utils.ts' */


/** @typedef {stream.Duplex} WebSocket */

export const statusCode = asConst({
  NORMAL_CLOSURE: 1000,
  GOING_AWAY: 1001,
  PROTOCOL_ERROR: 1002,
  UNSUPPORTED_DATA: 1003,
  NO_STATUS_RECEIVED: 1005, // reserved
  ABNORMAL_CLOSURE: 1006, // reserved
  INVALID_FRAME_PAYLOAD_DATA: 1007,
  POLICY_VIOLATION: 1008,
  MESSAGE_TOO_BIG: 1009,
  MANDATORY_EXTENSION: 1010,
  INTERNAL_ERROR: 1011,
  SERVICE_RESTART: 1012,
  TRY_AGAIN_LATER: 1013,
  BAD_GATEWAY: 1014,
  TLS_HANDSHAKE: 1015, // reserved
  UNAUTHORIZED: 3000,
  FORBIDDEN: 3003,
  TIMEOUT: 3008,
})

const byteMask = asConst({
  FIN_BIT: bitMask({ bits: 1, position: 0 }),
  OPCODE: bitMask({ bits: 4, position: 4 }),

  MASK_BIT: bitMask({ bits: 1, position: 0 }),
  PAYLOAD_LENGTH: bitMask({ bits: 7, position: 1 }),

  MODULO_4: bitMask({ bits: 2, position: 6 })
})

/** @typedef {opCodes[keyof opCodes]} OpCode */
const opCodes = asConst({
  FRAGMENT: 0x0,
  TEXT: 0x1,
  BINARY: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xA,
})

const waitingForData = Symbol('Waiting for data')
const frameComplete = Symbol('Frame complete')
const closed = Symbol('Closed')

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

/**
 * @typedef {{
 * }} Message
 *
 * @arg {stream.Duplex} socket
 * @arg {{ onMessage(message: Message): void }} config
 */
function handleWebSocketFrames(socket, { onMessage }) {

  /** @typedef {(() => State | symbol) | null} State */
  /** @type {State} */
  let state = readHeader
  let buffer = Buffer.alloc(0)
  /** @type {WritableStreamDefaultWriter<Buffer>} */
  let activeWriter = null

  socket.on('data', handleChunk)

  /** @arg {Buffer} chunk */
  function handleChunk(chunk) {
    buffer = Buffer.concat([buffer, chunk]) // TODO: replace with a more memory and garbage collector friendly version
    /** @type {State} */
    let previousState
    while (state && state !== previousState) {
      previousState = state
      const result = state()
      state = (
        result === waitingForData ? previousState :
        result === frameComplete ? readHeader :
        null
      )
    }
  }

  function readHeader() {
    if (buffer.length < 2) // Not enough data to parse anything useful in the header
      return waitingForData

    const firstByte = buffer[0]
    const fin = firstByte & byteMask.FIN_BIT
    const opCode = firstByte & byteMask.OPCODE

    const secondByte = buffer[1]
    const mask = secondByte & byteMask.MASK_BIT
    const payloadLength = secondByte & byteMask.PAYLOAD_LENGTH

    if (!mask)
      return closeConnection(statusCode.PROTOCOL_ERROR)

    if (!fin && isControlFrame(opCode))
      return closeConnection(statusCode.PROTOCOL_ERROR)

    buffer = buffer.subarray(2)

    return (
      payloadLength === 126 ? () => readExtendedPayloadLength16(fin, opCode) :
      payloadLength === 127 ? () => readExtendedPayloadLength64(fin, opCode) :
      () => readMask(fin, opCode, payloadLength)
    )
  }

  /**
   * @arg {number} fin
   * @arg {number} opCode
   */
  function readExtendedPayloadLength16(fin, opCode) {
    if (buffer.length < 2)
      return waitingForData

    const payloadLength = buffer.readUInt16BE()

    buffer = buffer.subarray(2)

    return () => readMask(fin, opCode, payloadLength)
  }

  /**
   * @arg {number} fin
   * @arg {number} opCode
   */
  function readExtendedPayloadLength64(fin, opCode) {
    if (buffer.length < 8)
      return waitingForData

    const payloadLength = buffer.readBigUInt64BE()

    buffer = buffer.subarray(8)

    return () => readMask(fin, opCode, payloadLength)
  }

  /**
   * @arg {number} fin
   * @arg {number} opCode
   * @arg {number | bigint} payloadLength
   */
  function readMask(fin, opCode, payloadLength) {
    if (buffer.length < 4)
      return waitingForData

    const mask = buffer.subarray(0, 4)

    buffer = buffer.subarray(4)

    return () => readPayload(fin, opCode, payloadLength, mask)
  }

  /**
   * @arg {number} fin
   * @arg {number} opCode
   * @arg {number | bigint} payloadLength
   * @arg {Buffer} mask
   */
  function readPayload(fin, opCode, payloadLength, mask) {

    return (
      opCode === opCodes.FRAGMENT ? () => readFragment(fin, payloadLength, mask) :
      opCode === opCodes.TEXT ? () => readData(fin, opCode, payloadLength, mask) :
      opCode === opCodes.BINARY ? () => readData(fin, opCode, payloadLength, mask) :
      opCode === opCodes.CLOSE ? () => readClose(fin, payloadLength, mask) :
      opCode === opCodes.PING ? () => readPing(fin, payloadLength, mask) :
      opCode === opCodes.PONG ? () => readPong(fin, payloadLength, mask) :
      closeConnection(statusCode.PROTOCOL_ERROR)
    )
  }

  /**
   * @arg {number} fin
   * @arg {number | bigint} payloadLength
   * @arg {Buffer} mask
   */
  function readFragment(fin, payloadLength, mask) {
    return () => readPayloadAsStream(fin, payloadLength, mask)
  }

  /**
   * @arg {number} fin
   * @arg {OpCode} opCode
   * @arg {number | bigint} payloadLength
   * @arg {Buffer} mask
   */
  function readData(fin, opCode, payloadLength, mask) {
    /** @type {TransformStream<Buffer, Buffer>} */
    const transformer = new TransformStream()
    const { readable, writable } = transformer

    activeWriter = writable.getWriter()

    onMessage(createMessage({ opCode, body: readable, isFragmented: !fin }))

    return () => readPayloadAsStream(fin, payloadLength, mask)
  }

  /**
   * @arg {number} fin
   * @arg {number | bigint} payloadLength
   * @arg {Buffer} mask
   * @arg {bigint} [bytesRead]
   */
  function readPayloadAsStream(fin, payloadLength, mask, bytesRead = 0n) {
    const bytesToRead = Math.min(buffer.length, Number(payloadLength)) // Since buffer.length is always smaller than the point where Number(bigint) causes precision loss, this is safe

    const unmasked = unmask(buffer, mask, bytesToRead, bytesRead)
    buffer = buffer.subarray(bytesToRead)

    activeWriter.write(unmasked)

    const totalBytesRead = bytesRead + BigInt(bytesToRead)
    const isFrameComplete = totalBytesRead === payloadLength

    if (isFrameComplete && fin) {
      activeWriter.close()
      activeWriter = null
    }

    if (isFrameComplete)
      return frameComplete

    return () => readPayloadAsStream(fin, payloadLength, mask, totalBytesRead)
  }

  /**
   * @arg {Buffer} buffer
   * @arg {Buffer} mask
   * @arg {number} bytesToRead
   * @arg {bigint} bytesRead
   */
  function unmask(buffer, mask, bytesToRead, bytesRead) {
    const unmasked = Buffer.alloc(bytesToRead)
    for (let i = 0; i < bytesToRead; i++) {
      const maskIndex = Number((bytesRead + BigInt(i)) & BigInt(byteMask.MODULO_4))
      unmasked[i] = buffer[i] ^ mask[maskIndex]
    }
    return unmasked
  }

  /** @arg {status[keyof status]} status */
  function closeConnection(status) {
    // send close message with status code
    socket.end()
    return closed
  }
}

/**
 * @arg {{
 *   opCode: opCodes[keyof opCodes],
 *   body: ReadableStream<Buffer>,
 *   isFragmented: Boolean,
 * }} props
 */
function createMessage({ opCode, body, isFragmented }) {
  return {
    opCode,
    isFragmented,
    body,
    json,
    text,
    arrayBuffer,
  }

  async function json() {
    const result = await text()
    return JSON.parse(result)
  }

  async function text() {
    const result = await consumeStream(body)
    return new TextDecoder().decode(result)
  }

  async function arrayBuffer() {
    const result = await consumeStream(body)
    return result.buffer
  }

  /** @arg {ReadableStream<Buffer>} readable */
  async function consumeStream(readable) {
    const chunks = /** @type {Buffer[]} */ ([])

    for await (const chunk of readable) {
      chunks.push(chunk)
    }

    return Buffer.concat(chunks)
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

/** @arg {number} opcode */
function isControlFrame(opcode) {
  return opcode >= 0x8
}

/**
 * @template {UnionOf<8, 1>} Bits
 * @arg {{ bits: Bits, position: UnionOf<Subtract<9, Bits>> }} options
 */
function bitMask({ bits, position }) {
  const mask = (1 << bits) - 1
  const shift = 8 - bits - position
  return mask << shift
}
