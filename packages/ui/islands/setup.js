import { importModuleScript } from '#ui/importModuleScript.js'
import { raw, tags } from '#ui/tags.js'
import { safeJsonStringify } from '#utils/safeJsonStringify.js'
import { clientConfig, clientConfigId } from './clientConfig.js'

const { script } = tags

export function ClientConfigProvider() {
  return script({ type: 'config', id: clientConfigId }, raw(safeJsonStringify(clientConfig)))
}

export function ImportMap({ importMap }) {
  return script({ type: 'importmap'}, raw(safeJsonStringify(importMap)))
}

export function HydrateComponents() {
  return importModuleScript('#ui/islands/hydrate-components.js')
}
