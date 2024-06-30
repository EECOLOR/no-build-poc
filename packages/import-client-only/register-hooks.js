// @ts-ignore - wel, heeft ie wel
import { register } from 'node:module'
import { clientFilesPort } from './hook-bridge.js'

register(
  './node-hooks/import-client-only.js',
  { parentURL: import.meta.url, data: { clientFilesPort }, transferList: [clientFilesPort] }
)
