import fs from 'node:fs'
import crypto from 'node:crypto'
import stream from 'stream/promises'

export function computeHash(content) {
  const hash = crypto.createHash('md5')
  hash.write(content)
  return hash.digest('hex')
}

export async function computeFileHash(filepath) {
  const input = fs.createReadStream(filepath)
  const hash = crypto.createHash('md5')
  await stream.pipeline(input, hash)
  return hash.digest('hex')
}
