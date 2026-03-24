
import { byteMasks, opCodes, statusCodes } from './constants.js'
import { WritableStream, TransformStream } from 'node:stream/web'
/** @import { State } from './socket.js' */
/** @import { ReadableStream } from 'node:stream/web' */

/** @typedef {ReturnType<typeof createMessage>} Message */

/** @type {((state: State) => symbol | void)[]} */
const frameSteps = [
  readHeader,
  function readPayloadLength(state) {
    const { initialPayloadLength } = state.frame
    return (
      initialPayloadLength === 127 ? readExtendedPayloadLength64(state) :
      initialPayloadLength === 126 ? readExtendedPayloadLength16(state) :
      useInitialPayloadLength(state)
    )
  },
  readMask,
  function prepareForData(state) {
    const { frame, output } = state
    return (
      frame.opCode === opCodes.FRAGMENT ? resumeFragment(state) :
      frame.opCode === opCodes.TEXT ? prepareForMessage(state) :
      frame.opCode === opCodes.BINARY ? prepareForMessage(state) :
      frame.opCode === opCodes.CLOSE ? prepareForControlFrame(state) :
      frame.opCode === opCodes.PING ? prepareForControlFrame(state) :
      frame.opCode === opCodes.PONG ? prepareForControlFrame(state) :
      close(output, statusCodes.PROTOCOL_ERROR)
    )
  },
  readPayloadData,
  function handleControlFrame(state) {
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

/** @arg {State} state */
export function parse(state) {
  while (state.frameStep || state.buffer.readableLength) {
    const stepFunction = frameSteps[state.frameStep]
    const result = stepFunction(state)

    if (result === waitingForData || result === closed)
      break

    const wasLastStep = state.frameStep === frameSteps.length - 1
    state.frameStep = wasLastStep ? 0 : state.frameStep + 1
  }
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
    return close(output, statusCodes.PROTOCOL_ERROR)

  if (!fin && isControlFrame(opCode))
    return close(output, statusCodes.PROTOCOL_ERROR)

  if (output.pendingFragmentWriter && isDataFrame(opCode))
    return close(output, statusCodes.PROTOCOL_ERROR)

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

  if (!output.activeWriter)
    throw new Error(`Expected output.activeWriter to be set`)

  const writePromise = output.activeWriter.write(data)
  if (Number(output.activeWriter.desiredSize) <= 0) { // deal with back pressure
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
    return close(output, statusCodes.NORMAL_CLOSURE)

  if (buffer.length < 2)
    return close(output, statusCodes.PROTOCOL_ERROR)

  const statusCode = buffer.readUInt16BE()
  const message = buffer.subarray(2).toString('utf-8')

  return close(output, statusCode, message)
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

/**
 * @arg {State['output']} output
 * @arg {number} status
 * @arg {string} [message]
 */
function close(output, status, message) {
  output.close(status, message)
  return closed
}

function noop() {}
