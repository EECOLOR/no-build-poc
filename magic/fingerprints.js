import { MessageChannel } from 'node:worker_threads'

const { port1, port2 } = new MessageChannel()

export const fingerprintPort = port2

/**
 * @typedef {{
 *  hash: string,
 *  filePath: string,
 *  relativePath: string,
 *  fingerprintPath: string,
 *  excludeFromImportMap: boolean,
 * }} Info
 */

/** @type {Array<Info>} */
const messages = []
/** @type {{ [fingerprintPath: string]: Info }} */
const infoByFingerprintPath = {}

port1.on('message', message => {
  infoByFingerprintPath[message.fingerprintPath] = message
  messages.push(message)
})

export function getFingerprintInfo(fingerprintPath) {
  return infoByFingerprintPath[fingerprintPath]
}

export function getAllFingerprintInfo() {
  return messages
}
