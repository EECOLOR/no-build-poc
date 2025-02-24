import { raw, tags } from './tags.js'

export function importModuleScript(src) {
  return tags.script({ type: 'module', defer: true }, raw(`import '${src}'`))
}
