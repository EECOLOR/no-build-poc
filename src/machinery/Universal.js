import { containerMarker } from '/machinery/containerMarker.js'
import { raw, tags } from '/machinery/tags.js'

const { script } = tags

/**
 * @template {string} T1
 * @template {(props: object) => any} T2
 * @param {T1} path
 * @param {T2} Component
 * @param {Parameters<T2>[0]} props
 * @returns
 */
export default function Universal(path, Component, props) {
  return [
    comment('start'),
    comment(JSON.stringify({
      path,
      // componentName: Component.name, // We probably need an import map or something
      props, // Should be 'safe encode'
    })),
    Component(props),
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
