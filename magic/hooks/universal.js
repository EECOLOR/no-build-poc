import path from 'node:path'
import { fileURLToPath } from 'node:url'

let universalSuffix = null
let universalModule = null

/**
 * @param {{
 *  universalSuffix: string,
 *  universalModule: string,
 * }} data
 */
export async function initialize(data) {
  universalSuffix = data.universalSuffix
  universalModule = data.universalModule
}

export async function load(url, context, nextLoad) {

  if (url.endsWith(universalSuffix)) {
    const componentPath = `/${path.relative(path.resolve('./src'), fileURLToPath(url))}`
    const serverSource = [
      `import Component from '${componentPath}#prevent-loader-recursion'`,
      `import Universal from '${universalModule}'`,
      ``,
      `export default props => Universal('${componentPath}', Component, props)`,
      ``,
    ].join('\n')

    return { format: 'module', shortCircuit: true, source: serverSource }
  }

  return nextLoad(url, context)
}
