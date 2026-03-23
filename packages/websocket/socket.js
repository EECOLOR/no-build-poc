import { PassThrough } from 'node:stream'
import { TransformStream, WritableStream, ReadableStream, TextEncoderStream } from 'node:stream/web'
import { opCodes, statusCodes, byteMasks, defaultFragmentSize } from './constants.js'

// TODO: Think about how to deal with errors that occur in the `on('data', chunk => ...)` handler.
//       Do we want to deal with it here or at the socket level where the `handleWebSocketFrames` is passed in?

/** @import { WritableStreamDefaultWriter } from 'node:stream/web' */
/** @import stream from 'node:stream' */

/** @typedef {ReturnType<typeof createState>} State */
/** @typedef {ReturnType<typeof createMessage>} Message */

const finalFrame = Symbol('Final frame')
const nonFinalFrame = Symbol('Non final frame')

/** @type {((state: State) => symbol | void)[]} */
const frameSteps = [
  readHeader,
  state => {
    const { initialPayloadLength } = state.frame
    return (
      initialPayloadLength === 127 ? readExtendedPayloadLength64(state) :
      initialPayloadLength === 126 ? readExtendedPayloadLength16(state) :
      useInitialPayloadLength(state)
    )
  },
  readMask,
  state => {
    const { frame, output } = state
    return (
      frame.opCode === opCodes.FRAGMENT ? resumeFragment(state) :
      frame.opCode === opCodes.TEXT ? prepareForMessage(state) :
      frame.opCode === opCodes.BINARY ? prepareForMessage(state) :
      frame.opCode === opCodes.CLOSE ? prepareForControlFrame(state) :
      frame.opCode === opCodes.PING ? prepareForControlFrame(state) :
      frame.opCode === opCodes.PONG ? prepareForControlFrame(state) :
      output.close(statusCodes.PROTOCOL_ERROR)
    )
  },
  readPayloadData,
  state => {
    const { frame } = state
    return (
      frame.opCode === opCodes.CLOSE ? handleClose(state) :
      frame.opCode === opCodes.PING ? handlePing(state) :
      frame.opCode === opCodes.PONG ? handlePong(state) :
      undefined
    )
  },
  cleanup,
]

const waitingForData = Symbol('Waiting for data')
const closed = Symbol('Closed')

/**
 * @arg {{
 *   socket: stream.Duplex,
 *   initialBytes: Buffer,
 *   onMessage(message: Message): void
 *   fragmentSize?: number,
 * }} config
 */
export function createWebSocket({ socket, initialBytes, onMessage, fragmentSize = defaultFragmentSize }) {
  const api = createApi(socket, fragmentSize)

  const heartbeat = startHeartbeat({
    ping: api.sendPing,
    onNoHeartbeat() { socket.end() }
  })
  socket.on('close', heartbeat.stopHeartbeat)

  const state = createState({
    onMessage,
    onPing: api.sendPong,
    onPong: heartbeat.pong,
    onClose(status, message = undefined) {
      api.sendClose(status, message).catch(noop).then(_ => { socket.end() })
    },
    onPause() { socket.pause() },
    onResume() { socket.resume() },
  })

  handleChunk(initialBytes)
  socket.on('data', handleChunk)

  return api

  /** @arg {Buffer} chunk */
  function handleChunk(chunk) {
    state.buffer.write(chunk)

    while (state.buffer.readableLength) {
      const stepFunction = frameSteps[state.frameStep]
      const result = stepFunction(state)
      if (result === waitingForData || result === closed)
        break

      const wasLastStep = state.frameStep === frameSteps.length - 1
      state.frameStep = wasLastStep ? 0 : state.frameStep + 1
    }
  }

  /** @arg {{ ping(): void, onNoHeartbeat(): void }} options */
  function startHeartbeat({ ping, onNoHeartbeat }) {
    let isAlive = true

    const heartbeat = setInterval(
      () => {
        if (isAlive) {
          isAlive = false
          ping()
        } else {
          stopHeartbeat()
          onNoHeartbeat()
        }
      },
      30 * 1000
    )

    return { stopHeartbeat, pong }

    function stopHeartbeat() {
      clearInterval(heartbeat)
    }

    function pong() {
      isAlive = true
    }
  }
}

/**
 * @arg {stream.Writable} socket
 * @arg {number} fragmentSize
 */
function createApi(socket, fragmentSize) {
  const api = {
    /** @arg {string | Uint8Array} [data] */
    sendPing(data = Buffer.alloc(0)) {
      const buffer = typeof data === 'string' ? Buffer.from(data) : data
      return sendFrame(socket, opCodes.PING, buffer, finalFrame)
    },
    /** @arg {string | Uint8Array} [data] */
    sendPong(data = Buffer.alloc(0)) {
      const buffer = typeof data === 'string' ? Buffer.from(data) : data
      return sendFrame(socket, opCodes.PONG, buffer, finalFrame)
    },
    /**
     * @arg {number} status
     * @arg {string} [message]
     */
    sendClose(status, message) {
      const statusBuffer = Buffer.allocUnsafe(2)
      statusBuffer.writeUInt16BE(status)
      const data = Buffer.concat([statusBuffer, Buffer.from(message)])
      return sendFrame(socket, opCodes.CLOSE, data, finalFrame)
    },
    /** @arg {string} text */
    sendText(text) {
      api.sendTextStream(ReadableStream.from([text]))
    },
    /** @arg {ReadableStream<string>} stream */
    sendTextStream(stream) {
      const byteStream = stream.pipeThrough(new TextEncoderStream())
      return sendStream(socket, opCodes.TEXT, byteStream, fragmentSize)
    },
    /** @arg {Buffer} binary */
    sendBinary(binary) {
      return api.sendBinaryStream(ReadableStream.from([binary]))
    },
    /** @arg {ReadableStream<Uint8Array>} stream */
    sendBinaryStream(stream) {
      return sendStream(socket, opCodes.BINARY, stream, fragmentSize)
    }
  }

  return api
}

/**
 * @arg {stream.Writable} socket
 * @arg {opCodes[keyof opCodes]} opCode
 * @arg {ReadableStream<Uint8Array>} stream
 * @arg {number} fragmentSize
 */
async function sendStream(socket, opCode, stream, fragmentSize) {
  let opCodeToUse = opCode
  const buffer = new PassThrough()

  for await (const chunk of stream) {
    await writeWithBackpressure(buffer, chunk)

    while (buffer.readableLength > fragmentSize) {
      const data = buffer.read(fragmentSize)
      await sendFrame(socket, opCodeToUse, data, nonFinalFrame)
      opCodeToUse = opCodes.FRAGMENT
    }
  }

  await sendFrame(socket, opCodeToUse, buffer.read() || Buffer.alloc(0), finalFrame)
}

/**
 * @arg {stream.Writable} socket
 * @arg {opCodes[keyof opCodes]} opCode
 * @arg {Uint8Array} payload
 * @arg {typeof finalFrame | typeof nonFinalFrame} frameType
 */
async function sendFrame(socket, opCode, payload, frameType) {
  const fin = frameType === finalFrame ? byteMasks.FIN_BIT : 0
  const payloadLength = payload.length
  const firstByte = fin | opCode

  /** @type {Buffer} */
  let header
  if (payloadLength > (1 << 16) - 1) {
    header = Buffer.alloc(2 + 8)
    header[0] = firstByte
    header[1] = 127
    header.writeBigInt64BE(BigInt(payloadLength), 2)
  } else if (payloadLength > 125) {
    header = Buffer.alloc(2 + 2)
    header[0] = firstByte
    header[1] = 126
    header.writeUint16BE(payloadLength, 2)
  } else {
    header = Buffer.alloc(2)
    header[0] = firstByte
    header[1] = payloadLength
  }

  socket.write(header)
  if (payloadLength)
    await writeWithBackpressure(socket, payload)
}

/**
 * @arg {stream.Writable} writable
 * @arg {Uint8Array} data
 */
function writeWithBackpressure(writable, data) {
  return new Promise(resolve => {
    const drained = writable.write(data)

    if (drained)
      resolve()
    else
      writable.once('drain', resolve)
  })
}

/** @arg {State} state */
function readHeader({ buffer, output, frame }) {
  if (buffer.readableLength < 2) // Not enough data to parse anything useful in the header
    return waitingForData

  const [firstByte, secondByte] = buffer.read(2)
  const fin = firstByte & byteMasks.FIN_BIT
  const opCode = firstByte & byteMasks.OPCODE
  const mask = secondByte & byteMasks.MASK_BIT
  const payloadLength = secondByte & byteMasks.PAYLOAD_LENGTH

  if (!mask)
    return output.close(statusCodes.PROTOCOL_ERROR)

  if (!fin && isControlFrame(opCode))
    return output.close(statusCodes.PROTOCOL_ERROR)

  if (output.pendingFragmentWriter && isDataFrame(opCode))
    return output.close(statusCodes.PROTOCOL_ERROR)

  frame.fin = fin
  frame.opCode = opCode
  frame.initialPayloadLength = payloadLength
}

/** @arg {State} state */
function readExtendedPayloadLength64({ buffer, frame }) {
  if (buffer.readableLength < 8)
    return waitingForData

  frame.payloadLength = buffer.read(8).readBigUInt64BE()
}

/** @arg {State} state */
function readExtendedPayloadLength16({ buffer, frame }) {
  if (buffer.readableLength < 2)
    return waitingForData

  frame.payloadLength = buffer.read(2).readUInt16BE()
}

/** @arg {State} state */
function useInitialPayloadLength({ frame }) {
  frame.payloadLength = BigInt(frame.initialPayloadLength)
}

/** @arg {State} state */
function readMask({ buffer, frame }) {
  if (buffer.readableLength < 4)
    return waitingForData

  frame.mask = buffer.read(4)
}

/** @arg {State} state */
function resumeFragment({ output }) {
  output.continueWithFragment()
}

/** @arg {State} state */
function prepareForMessage({ output, frame }) {
  /** @type {TransformStream<Buffer, Buffer>} */
  const transformer = new TransformStream()
  const { readable, writable } = transformer
  output.activeWriter = writable.getWriter()

  const { opCode, fin } = frame
  output.onMessage(createMessage({ opCode, body: readable, isFragmented: !fin }))
}

/** @arg {State} state */
function prepareForControlFrame({ control, output }) {
  const writable = createBufferWriter(control.buffer)
  output.activeWriter = writable.getWriter()
}

/** @arg {State} state */
function readPayloadData({ buffer, frame, input, output }) {
  const { payloadLength, mask, bytesRead } = frame

  const requiredBytes = payloadLength - bytesRead
  if (!requiredBytes)
    return // nothing to read, we are done

  const availableBytes = buffer.readableLength
  if (!availableBytes)
    return waitingForData

  const bytesToRead = Math.min(availableBytes, Number(requiredBytes)) // Since buffer.length is always smaller than the point where Number(bigint) causes precision loss, this is safe

  const data = buffer.read(bytesToRead)
  unmask(data, mask, bytesRead)
  frame.bytesRead += BigInt(bytesToRead)

  const writePromise = output.activeWriter.write(data)
  if (output.activeWriter.desiredSize <= 0) { // deal with back pressure
    input.pause()
    writePromise.catch(noop).then(_ => { input.resume() })
  }

  if (frame.bytesRead < payloadLength)
    return waitingForData
}

/** @arg {State} state */
function handleClose({ control, output }) {
  const { buffer } = control

  if (!buffer.length)
    return output.close(statusCodes.NORMAL_CLOSURE)

  if (buffer.length < 2)
    return output.close(statusCodes.PROTOCOL_ERROR)

  const statusCode = buffer.readUInt16BE()
  const message = buffer.subarray(2).toString('utf-8')

  return output.close(statusCode, message)
}

/** @arg {State} state */
function handlePing({ control, output }) {
  const { buffer } = control
  output.onPing(buffer)
}

/** @arg {State} state */
function handlePong({ control, output }) {
  const { buffer } = control
  output.onPong(buffer)
}

/** @arg {State} state */
function cleanup({ frame, output }) {
  if (frame.fin)
    output.closeActiveWriter()
  else
    output.waitForFragment()

  frame.reset()
}

/**
  * @arg {Buffer} buffer
  * @arg {Buffer} mask
  * @arg {bigint} bytesRead
  */
function unmask(buffer, mask, bytesRead) {
  const bytesToRead = buffer.length
  const modulo4 = BigInt(byteMasks.MODULO_4)
  for (let i = 0; i < bytesToRead; i++) {
    const maskIndex = Number((bytesRead + BigInt(i)) & modulo4)
    buffer[i] = buffer[i] ^ mask[maskIndex]
  }
}

/**
 * @arg {{
 *   onMessage(message: Message): void,
 *   onPing(data: Buffer): void
 *   onPong(data: Buffer): void,
 *   onClose(status: number, message?: string): void,
 *   onPause(): void,
 *   onResume(): void,
 * }} config
 */
function createState({ onMessage, onPing, onPong, onClose, onPause, onResume }) {
  const buffer = new PassThrough()
  const controlBuffer = Buffer.alloc(125) // Control data can not be larger than 125 bytes

  const initialFrame = { // If this at one point in time will contain non-primitives, make sure to address the result logic
    fin: 0,
    opCode: 0,
    initialPayloadLength: 0,
    payloadLength: 0n,
    mask: /** @type {null | Buffer} */ (null),
    bytesRead: 0n,
  }

  const frame = {
    ...initialFrame,
    reset() { Object.assign(frame, initialFrame) },
  }

  const input = {
    pause: onPause,
    resume: onResume,
  }

  const output = {
    activeWriter: /** @type {WritableStreamDefaultWriter<Buffer> | null} */ (null),
    pendingFragmentWriter: /** @type {WritableStreamDefaultWriter<Buffer> | null} */ (null),
    waitForFragment() {
      output.pendingFragmentWriter = output.activeWriter
      output.activeWriter = null
    },
    continueWithFragment() {
      output.activeWriter = output.pendingFragmentWriter
      output.pendingFragmentWriter = null
    },
    closeActiveWriter() {
      output.activeWriter.close()
      output.activeWriter = null
    },
    onMessage,
    onPing,
    onPong,
    /**
     * @arg {number} status
     * @arg {string} [message]
     */
    close(status, message) {
      onClose(status, message)
      return closed
    },
  }

  const control = {
    get buffer() {
      return controlBuffer.subarray(0, Number(frame.payloadLength))
    }
  }

  return {
    frameStep: 0,
    control,
    frame,
    get buffer() { return buffer },
    input,
    output,
  }
}

/**
* @arg {{
*   opCode: number,
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

/** @arg {number} opCode */
function isControlFrame(opCode) {
  return opCode >= 0x8
}

/** @arg {number} opCode */
function isDataFrame(opCode) {
  return opCode === opCodes.TEXT || opCode === opCodes.BINARY
}

/** @arg {Buffer} target */
function createBufferWriter(target) {
  let cursor = 0

  return new WritableStream({
    /** @arg {Buffer} chunk */
    write(chunk) {
      const newCursor = cursor + chunk.length
      if (newCursor > target.length)
        throw new Error(`Error writing chunk as it would exceed ${target.length} bytes`)

      target.set(chunk, cursor)
      cursor = newCursor
    }
  })
}

function noop() {}
