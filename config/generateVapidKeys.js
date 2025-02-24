#!/usr/bin/env node

import { generateKeyPairSync } from 'node:crypto'
import { statSync, writeFileSync } from 'node:fs'

ensureKeyFile('./config/vapid_keys.json')

function ensureKeyFile(keyFile) {
  if (statSync(keyFile, { throwIfNoEntry: false })?.isFile())
    return

  writeFileSync(keyFile, JSON.stringify(generateVapidKeys(), null, 2))
}


function generateVapidKeys() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })

  const publicKeyBuffer = Buffer.from(
    publicKey.export({ type: 'spki', format: 'der' }).subarray(26)
  )

  return {
    publicKeyBase64Url: publicKeyBuffer.toString('base64url'),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  }
}
