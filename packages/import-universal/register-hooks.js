// @ts-ignore - wel, heeft ie wel
import { register } from 'node:module'
import { universalFilesPort } from './hook-bridge.js'

const parentURL = import.meta.url

register(
  './node-hooks/universal.js',
  { parentURL, data: { universalFilesPort }, transferList: [universalFilesPort] }
)
