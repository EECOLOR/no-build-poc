// TODO: escape html
// /** @typedef {((...children: Array<string>) => string) | ((attributes: object, ...children: Array<string>) => string)} Tag */

import { writeToDom } from './domInteraction.js'

const encoder = new TextEncoder()
export function raw(str) { return encoder.encode(str) }
const escapeHtml = createHtmlEscape()
const emptyValues = [false, undefined, null]
const emptyUint8Array = new Uint8Array()
const emptyObject = {}

/**
 * @template T
 * @typedef {import('/machinery/signal.js').Signal<T>} Signal
 */

/**
 * @typedef {'children' | 'dangerouslySetInnerHTML'} ForbiddenJsxProperties
 */

/**
 * @template {object} T
 * @typedef {{ [key in keyof T]: T[key] | Signal<T[key]>}} AllowSignalValue
 */

/**
 * @template {TagNames} tagName
 * @typedef {AllowSignalValue<Omit<JSX.IntrinsicElements[tagName],
 *  'children' | 'key' | 'ref' | 'dangerouslySetInnerHTML' |
 *  'defaultChecked' | 'defaultValue' |
 *   'suppressContentEditableWarning' | 'suppressHydrationWarning' |
 *  ExcludeTagSpecific<tagName>
 * >>} Attributes
 */

/**
 * @template {string} tagName
 * @typedef {(
 *   tagName extends 'select' ? 'value' :
 *   tagName extends 'textarea' ? 'value' :
 *   never
 * )} ExcludeTagSpecific
 */

/**
 * @template {TagNames} key
 * @typedef {JSX
 *  .IntrinsicElements[key] extends React.DetailedHTMLProps<infer Y, infer X> ? X : never
 * } HtmlElementFor
 */
/**
 * @template T
 * @typedef {T extends HTMLElement | string | number | boolean | null | undefined | Signal<any> | Uint8Array ? T : never} Child
 */

/** @template T @typedef {Array<Child<any>>} Children */
/** @typedef {keyof JSX.IntrinsicElements} TagNames */
/** @template {TagNames} tagName @typedef {any} Tag */

export const tags = new Proxy(
  /**
   * @type {{
   *   [tagName in TagNames]: <T, X extends Children<X>>
   *     (childOrAttributes?: Child<T> | Attributes<tagName>, ...children: X) => Tag<tagName>
   * }}
   */
  ({}), {
  get(_, tagName) {
    return function tag(attributesOrChild = emptyObject, ...children) {
      const hasAttributes = attributesOrChild.constructor === Object
      const attributes = hasAttributes ? attributesOrChild : emptyObject
      if (!hasAttributes) children.unshift(attributesOrChild)
      return renderTag(tagName, attributes, children.flat())
    }
  }
})

function renderTag(tagName, attributes, children) {
  const renderTag = typeof window === 'undefined'
    ? renderServerTag
    : renderClientTag

  return renderTag(tagName, attributes, children)
}

/** @returns {Uint8Array} */
function renderServerTag(tagName, attributes, children) {
  return concatUint8Array(
    raw(`<${[tagName, renderServerAttributes(attributes)].join(' ')}>`),
    asEncoded(children),
    raw(`</${tagName}>`),
  )
}

function renderServerAttributes(attributes) {
  return Object.entries(attributes)
    .flatMap(([k, v]) => {
      if (k.startsWith('on')) return []
      if (k === 'className') k = 'class'
      const value = isSignal(v) ? v.get() : v
      return `${k}="${escapeHtml(String(value))}"`
    })
    .join(' ')
}

/** @returns {Uint8Array} */
function asEncoded(value) {
  return (
    emptyValues.includes(value) ? emptyUint8Array :
    Array.isArray(value) ? concatUint8Array(...value.map(asEncoded)) :
    isSignal(value) ? asEncoded([emptyComment()].concat(value.get())) :
    value instanceof Uint8Array ? value :
    raw(escapeHtml(String(value)))
  )
}

function emptyComment() {
  return raw('<!---->')
}

function renderClientTag(tagName, attributes, children) {
  /** @type {HTMLElement} */
  const element = document.createElement(tagName)

  Object.entries(attributes).forEach(([k, v]) => {
    if (k.startsWith('on')) element[k.toLowerCase()] = v
    else if (v?.get) bindSignalToAttribute(element, k, v)
    else if (k === 'style') Object.assign(element.style, v)
    else if (k in element) element[k] = v
    else element.setAttribute(k, v)
  })

  const nodes = combineTextNodes(children.flatMap(asNodes))
  nodes.forEach(node => { element.appendChild(node) })

  return element
}

function bindSignalToAttribute(element, attribute, signal) {
  element.setAttribute(attribute, signal.get())

  // TODO: unsubscribe when element is removed
  const unsubscribe = signal.subscribe(value =>
    writeToDom.outsideAnimationFrame(() => {
      element.setAttribute(attribute, value)
    })
  )
}

/** @param {Signal<any>} signal */
function signalAsNodes(signal) {
  const marker = comment()
  let nodes = [marker, ...asNodes(signal.get())]

  // TODO: unsubscribe when element is removed
  const unsubscribe = signal.subscribe(newValue => {
    const newNodes = asNodes(newValue)
    const oldNodes = nodes.slice(1)

    swapNodes(marker, newNodes, oldNodes)

    nodes.splice(1, Infinity, ...newNodes)
  })

  return nodes
}

function swapNodes(marker, newNodes, oldNodes) {
  writeToDom.outsideAnimationFrame(() => {
    const lastNode = newNodes[oldNodes.length - 1] || marker
    oldNodes.forEach((node, i) => { node.replaceWith(newNodes[i]) })
    const leftOverNewNodes = newNodes.slice(oldNodes.length)
    lastNode.after(...leftOverNewNodes)
  })
}

function comment() {
  return document.createComment('')
}

/** @returns {Array<ChildNode>} */
function asNodes(value) {
  return (
    emptyValues.includes(value) ? [] :
    Array.isArray(value) ? value.flatMap(asNodes) :
    value instanceof Element ? [value] :
    isSignal(value) ? signalAsNodes(value) :
    [document.createTextNode(String(value))]
  )
}

const emptyArray = []
function combineTextNodes(nodes) {
  return nodes.flatMap((node, i) => {
    if (!i || node.nodeType !== 3) return [node]
    const previous = nodes[i - 1]
    if (previous.nodeType !== 3) return [node]
    previous.nodeValue += node.nodeValue || ' '
    return emptyArray
  })
}

/** @type {(value: Object) => value is import('./signal.js').Signal<any>}*/
function isSignal(value) {
  return value.get && value.subscribe
}

// This can be faster, check the source of Preact for a faster version
function createHtmlEscape() {
  const escapeRegex = /[&<>'"]/g
  const escapeLookup = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }

  return function escape(str) {
    return str.replace(escapeRegex, escapeFunction)
  }

  function escapeFunction(match) {
    return escapeLookup[match]
  }
}

/**
 * @param  {...Uint8Array} arrays
 * @returns {Uint8Array}
 */
function concatUint8Array(...arrays) {
  const totalLength = arrays.reduce((result, array) => result + array.length, 0)

  let offset = 0
  const result = new Uint8Array(totalLength)
  for (const array of arrays) {
    result.set(array, offset)
    offset += array.length
  }

  return result
}
