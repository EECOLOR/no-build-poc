import { separatePropsAndChildren } from '#utils'
import { containerMarker } from './containerMarker.js'
import { raw, tags } from '#ui/tags.js'

const { script } = tags

export default function Universal(path, Component, params) {
  const { props } = separatePropsAndChildren(params)
  return [
    comment('start'),
    comment(JSON.stringify({
      path,
      props, // Should be 'safe encode'
    })),
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

function comment(content) {
  return raw(`<!--${content}-->`)
}
