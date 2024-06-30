// @ts-ignore - wel, heeft ie wel
import { register } from 'node:module'
import { processedCssPort } from './hook-bridge.js'

register(
  './node-hooks/import-css.js',
  { parentURL: import.meta.url, data: { processedCssPort }, transferList: [processedCssPort] }
)
