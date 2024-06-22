import { containerMarker } from '/machinery/containerMarker.js'
import { partitionAttributesAndChildren, raw, tags } from '/machinery/tags.js'

const { script } = tags

const serverSideContext = {
  get isClient() { return false },
  get domElements() { return null },
}

const noAttributes = { attributes: null }

/**
 * @template {string} T1
 * @template {(props: object, context?: { domElement: any }) => any} T2
 * @param {T1} path
 * @param {T2} Component
 * @param {Parameters<T2>[0]} params
 * @returns
 */
export default function Universal(path, Component, params) {
  const { attributes } = params.length ? partitionAttributesAndChildren(params) : noAttributes
  return [
    comment('start'),
    comment(JSON.stringify({
      path,
      // componentName: Component.name, // We probably need an import map or something
      props: attributes, // Should be 'safe encode'
    })),
    Component.apply(serverSideContext, params),
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

function comment(content) {
  return raw(`<!--${content}-->`)
}
