// @ts-ignore - wel, heeft ie wel
import { register } from 'node:module'
import { fingerprintPort } from './magic/fingerprints.js'

register(
  './magic/node-import-resolver.js',
  { parentURL: import.meta.url, data: { fingerprintPort }, transferList: [fingerprintPort] }
)
