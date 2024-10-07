import { separatePropsAndChildren } from '#ui/utils.js'
import { containerMarker } from './containerMarker.js'
import { raw, tags } from '#ui/tags.js'
import { safeJsonStringify } from '#utils/safeJsonStringify.js'
import { clientConfig, clientConfigId } from './clientConfig.js'

const { script } = tags

export function Island(path, Component, ...params) {
  const { props } = separatePropsAndChildren(params)
  return [
    comment('start'),
    comment(safeJsonStringify({ name: Component.name, path, props })),
    Component(...params),
    comment('end'),
    script(raw(
      `var d=document,s=d.currentScript,p=s.parentNode;` +
      /* set marker on container so we can retrieve nodes that contain components */
      `p.setAttribute('${containerMarker}','');` +
      /* remove the script tag itself */
      `p.removeChild(s);`
    ))
  ]
}

export function ClientConfigProvider() {
  return script({ type: 'config', id: clientConfigId }, raw(safeJsonStringify(clientConfig)))
}

export function ImportMap({ importMap }) {
  return script({ type: 'importmap'}, raw(safeJsonStringify(importMap)))
}

export function HydrateComponents() {
  return script({ type: 'module', defer: true }, raw(`import '#islands/hydrate-components.js'`))
}

function comment(content) {
  return raw(`<!--${content}-->`)
}