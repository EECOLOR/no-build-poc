/** @import { Children, ChildOrAttributes, TagNames, Attributes } from './tags.js' */

/**
 * @template {TagNames} TagName
 * @template T
 * @template {Children<X>} X
 * @arg {[ChildOrAttributes<T, TagName>, ...children: X]} params
 */
export function separatePropsAndChildren(params) {
  const [propsOrChild, ...children] = params
  const hasProps = isProps(propsOrChild)

  return {
    props: hasProps ? propsOrChild: null,
    children: hasProps ? children : params
  }
}

/**
 * @template {TagNames} TagName
 * @template T
 * @arg {ChildOrAttributes<T, TagName>} propsOrChild
 * @returns {propsOrChild is Attributes<TagName>}
 */
function isProps(propsOrChild) {
  return propsOrChild?.constructor === Object
}

let counter = 0
export function createUniqueId() {
  return `id-${counter++}`
}

export function combineRefs(...refs) {
  return function ref(element) {
    for (const ref of refs) ref?.(element)
  }
}
