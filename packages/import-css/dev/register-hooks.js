// @ts-ignore - wel, heeft ie wel
import { register } from 'node:module'
import fs from 'node:fs'
import { handleShutdown } from '#utils/shutdown.js'
import { cssFilesPort } from './hook-bridge.js'

const cssTmpDir = './tmp-css/'

register(
  './node-hooks/import-css.js',
  { parentURL: import.meta.url, data: { cssFilesPort, cssTmpDir }, transferList: [cssFilesPort] }
)

handleShutdown(() => {
  console.log('Shutdown detected, initiating css cleanup')
  fs.rmSync(cssTmpDir, { recursive: true, force: true })
})
