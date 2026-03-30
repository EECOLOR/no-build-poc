import { PassThrough } from 'node:stream'
import { defaultFragmentSize } from './constants.js'
import { parse } from './parser.js'
import { createApi } from './sender.js'
/** @import { WritableStreamDefaultWriter } from 'node:stream/web' */
/** @import stream from 'node:stream' */
/** @import { Message } from './parser.js' */

// TODO: Think about how to deal with errors that occur in the `on('data', chunk => ...)` handler.
//       Do we want to deal with it here or at the socket level where the `handleWebSocketFrames` is passed in?

/** @typedef {ReturnType<typeof createWebSocket>} WebSocket */
/** @typedef {ReturnType<typeof createState>} State */

/**
 * @arg {{
 *   socket: stream.Duplex,
 *   initialBytes: Buffer,
 *   fragmentSize?: number,
 * }} config
 */
export function createWebSocket({ socket, initialBytes, fragmentSize = defaultFragmentSize }) {
  const api = createApi(socket, fragmentSize)

  let listening = false

  return {
    ...api,
    start,
  }

  /**
   * @arg {(message: Message) => void} onMessage
   */
  function start(onMessage) {
    if (listening)
      throw new Error(`Already listening`)

    listening = true

    const heartbeat = startHeartbeat({
      ping: api.sendPing,
      onNoHeartbeat() { socket.end() }
    })
    socket.on('close', heartbeat.stopHeartbeat)

    const state = createState({
      onMessage,
      onPing: api.sendPong,
      onPong: heartbeat.pong,
      close(status, message = undefined) {
        api.sendClose(status, message).catch(noop).then(_ => { socket.end() })
      },
      onPause() { socket.pause() },
      onResume() { socket.resume() },
    })

    handleChunk(initialBytes)
    socket.on('data', handleChunk)

    /** @arg {Buffer} chunk */
    function handleChunk(chunk) {
      state.buffer.write(chunk)
      parse(state)
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
 * @arg {{
 *   onMessage(message: Message): void,
 *   onPing(data: Buffer): void
 *   onPong(data: Buffer): void,
 *   onPause(): void,
 *   onResume(): void,
 *   close(status: number, message?: string): void,
 * }} config
 */
function createState({ onMessage, onPing, onPong, close, onPause, onResume }) {
  const buffer = new PassThrough()
  const controlBuffer = Buffer.alloc(125) // Control data can not be larger than 125 bytes

  const initialFrame = { // If this at one point in time will contain non-primitives, make sure to address the reset logic
    fin: 0,
    opCode: 0,
    initialPayloadLength: 0,
    payloadLength: 0n,
    mask: Buffer.alloc(0),
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
      output.activeWriter?.close()
      output.activeWriter = null
    },
    onMessage,
    onPing,
    onPong,
    close,
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

function noop() {}
