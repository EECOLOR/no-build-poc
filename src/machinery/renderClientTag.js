import { Component } from './component.js'
import { writeToDom } from './domInteraction.js'
import { isSignal } from './signal.js'
import { emptyValues, Tag } from './tags.js'

/** @typedef {import('./tags.js').TagNames} TagNames */

/**
 * @template {TagNames} key
 * @typedef {key extends any ? HTMLElement :
 *  JSX.IntrinsicElements[key] extends React.DetailedHTMLProps<infer Y, infer X> ? X : never
 * } HtmlElementFor
 */

/**
 * @template {TagNames} tagName
 * @param {Tag<tagName>} props
 * @returns {HtmlElementFor<tagName>}
 */
export function renderClientTag({ tagName, attributes, children }) {
  const element = document.createElement(tagName)

  if (attributes)
    Object.entries(attributes).forEach(([k, v]) => {
      if (k.startsWith('on')) element[k.toLowerCase()] = v
      else if (isSignal(v)) bindSignalToAttribute(element, k, v)
      else if (k === 'style') Object.assign(element.style, v)
      else setAttributeOrProperty(element, k, v)
    })

  const nodes = combineTextNodes(children.flatMap(asNodes))
  nodes.forEach(node => { element.appendChild(node) })

  return element
}

function setAttributeOrProperty(element, k, v) {
  if (k in element) element[k] = v
  else element.setAttribute(k, v)
}

function bindSignalToAttribute(element, attribute, signal) {
  setAttributeOrProperty(element, attribute, signal.get())

  // TODO: unsubscribe when element is removed
  const unsubscribe = signal.subscribe(value =>
    writeToDom.outsideAnimationFrame(() => {
      setAttributeOrProperty(element, attribute, value)
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
    value instanceof Component ? asNodes(renderComponent(value)) :
    isSignal(value) ? signalAsNodes(value) :
    [document.createTextNode(String(value))]
  )
}

function renderComponent({ constructor, props, children }) {
  const params = props ? [props].concat(children) : children
  return constructor(...params)
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
