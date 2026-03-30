import { byteMasks, opCodes } from './constants.js'
import { ReadableStream, TextEncoderStream } from 'node:stream/web'
import { PassThrough } from 'node:stream'
/** @import stream from 'node:stream' */

const finalFrame = Symbol('Final frame')
const nonFinalFrame = Symbol('Non final frame')

/**
 * @arg {stream.Writable} socket
 * @arg {number} fragmentSize
 */
export function createApi(socket, fragmentSize) {
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
      const data = Buffer.concat([statusBuffer, Buffer.from(message || '')])
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
  return /** @type {Promise<void>} */ (
    new Promise(resolve => {
      const drained = writable.write(data)

      if (drained)
        resolve()
      else
        writable.once('drain', resolve)
    })
  )
}
