import { separatePropsAndChildren } from '#ui/utils.js'
import { containerMarker } from './containerMarker.js'
import { raw, tags } from '#ui/tags.js'
import { safeJsonStringify } from '#utils/safeJsonStringify.js'

const { script } = tags

/**
 * @template {any[]} X
 * @template Y
 * @param {string} path
 * @param {(...params: X) => Y} Component
 * @param  {X} params
 * @returns
 */
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

function comment(content) {
  return raw(`<!--${content}-->`)
}
