import { writeToDom } from './domInteraction.js'
import { isSignal } from './signal.js'
import { emptyValues, Tag } from './tags.js'

export function renderClientTag({ tagName, attributes, children }) {
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

/** @param {import('./signal.js').Signal<any>} signal */
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
    value instanceof Tag ? [renderClientTag(value)] :
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
