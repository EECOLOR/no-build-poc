// TODO: escape html
/** @typedef {((...children: Array<string>) => string) | ((attributes: object, ...children: Array<string>) => string)} Tag */

import { writeToDom } from './domInteraction.js'

const emptyValues = [false, undefined, null]

export const tags = new Proxy(/** @type {any} */ ({}), {
  get(_, /** @type {string} */ tagName) {
    return function tag(attributesOrChild = {}, ...otherChildren) {
      const hasAttributes = attributesOrChild.constructor === Object
      const attributes = hasAttributes ? attributesOrChild : {}
      const children = hasAttributes ? otherChildren : [attributesOrChild].concat(otherChildren)
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

function renderServerTag(tagName, attributes, children) {
  return [
    `<${[tagName].concat(renderServerAttributes(attributes)).join(' ')}>`,
      asString(children),
    `</${tagName}>`,
  ].join('')
}

function renderServerAttributes(attributes) {
  return Object.entries(attributes).flatMap(([k, v]) => {
    if (k.startsWith('on')) return []
    const value = isSignal(v) ? v.get() : v
    return `${k}="${value}"`
  })
}

function asString(value) {
  return (
    emptyValues.includes(value) ? '' :
    Array.isArray(value) ? value.map(asString).join('') :
    isSignal(value) ? asString(value.get()) :
    String(value)
  )
}

function renderClientTag(tagName, attributes, children) {
  /** @type {HTMLElement} */
  const element = document.createElement(tagName)

  Object.entries(attributes).forEach(([k, v]) => {
    if (k.startsWith('on')) element[k.toLowerCase()] = v
    else if (v?.get) bindSignalToAttribute(element, k, v)
    else if (k === 'style') Object.assign(element.style, v)
    else element.setAttribute(k, v)
  })

  children.forEach(child => {
    const nodes = asNodes(child)
    nodes.forEach(node => element.appendChild(node))
  })
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

/** @param {import('/machinery/signal.js').Signal<any>} signal */
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

/** @type {(value: Object) => value is import('./signal.js').Signal<any>}*/
function isSignal(value) {
  return value.get && value.subscribe
}
