// @ts-ignore - wel, heeft ie wel
import { register } from 'node:module'
import { cssFilesPort } from './hook-bridge.js'

register(
  './node-hooks/import-css.js',
  { parentURL: import.meta.url, data: { cssFilesPort }, transferList: [cssFilesPort] }
)
