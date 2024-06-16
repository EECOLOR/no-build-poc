// @ts-ignore - wel, heeft ie wel
import { register } from 'node:module'
import { processedCssPort, clientFilesPort } from './magic/bridge.js'

const parentURL = import.meta.url
const universalSuffix = '.universal.js'
const clientSuffix = '.client.js'
const universalModule = '/machinery/Universal.js'

register(
  './magic/hooks/css.js',
  { parentURL, data: { processedCssPort }, transferList: [processedCssPort] }
)

register(
  `./magic/hooks/root-slash-import.js`,
  { parentURL }
)

register(
  './magic/hooks/universal.js',
  { parentURL, data: { universalSuffix, universalModule } }
)

register(
  './magic/hooks/client-files.js',
  { parentURL, data: { clientFilesPort, clientSuffix, universalSuffix }, transferList: [clientFilesPort] }
)
