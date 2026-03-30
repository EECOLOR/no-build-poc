import { asConst } from '#typescript/helpers.js'
/** @import { UnionOf, Subtract } from '#typescript/utils.ts' */

export const statusCodes = asConst({
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

export const byteMasks = asConst({
  FIN_BIT: bitMask({ bits: 1, position: 0 }),
  OPCODE: bitMask({ bits: 4, position: 4 }),

  MASK_BIT: bitMask({ bits: 1, position: 0 }),
  PAYLOAD_LENGTH: bitMask({ bits: 7, position: 1 }),

  MODULO_4: bitMask({ bits: 2, position: 6 })
})

/** @typedef {opCodes[keyof opCodes]} OpCode */
export const opCodes = asConst({
  FRAGMENT: 0x0,
  TEXT: 0x1,
  BINARY: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xA,
})

export const defaultFragmentSize = 32 * 1024

/**
* @template {UnionOf<8, 1>} Bits
* @arg {{ bits: Bits, position: UnionOf<Subtract<9, Bits>> }} options
*/
function bitMask({ bits, position }) {
  const mask = (1 << bits) - 1
  const shift = 8 - bits - position
  return mask << shift
}
