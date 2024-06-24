import { Component, renderComponent } from './component.js'
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
 * @template {Tag<any> | Component<any>} T
 * @param {T} tagOrComponent
 * @returns {T extends Tag<infer tagName> ? HtmlElementFor<tagName> : T extends Component<T> ? any : never} // We could type this better for components, but that's not for now
 */
export function render(tagOrComponent) {
  return (
    tagOrComponent instanceof Component ? asNodes(...renderComponent(tagOrComponent, {})) :
    tagOrComponent instanceof Tag ? renderClientTag(tagOrComponent, {}) :
    throwError(`Can only render tags and components`)
  )
}

/** @returns {never} */
function throwError(message) { throw new Error(message) }

function renderClientTag({ tagName, attributes, children }, context) {
  const element = document.createElement(tagName)

  if (attributes)
    Object.entries(attributes).forEach(([k, v]) => {
      if (k.startsWith('on')) element[k.toLowerCase()] = v
      else if (isSignal(v)) bindSignalToAttribute(element, k, v)
      else if (k === 'style') Object.assign(element.style, v)
      else setAttributeOrProperty(element, k, v)
    })

  const nodes = combineTextNodes(children.flatMap(x => asNodes(x, context)))
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

/**
 * @param {import('./signal.js').Signal<any>} signal
 * @param {any} context
 */
function signalAsNodes(signal, context) {
  const marker = comment()
  let nodes = [marker, ...asNodes(signal.get(), context)]

  // TODO: unsubscribe when element is removed
  const unsubscribe = signal.subscribe(newValue => {
    const newNodes = asNodes(newValue, context)
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
function asNodes(value, context) {
  return (
    emptyValues.includes(value) ? [] :
    Array.isArray(value) ? value.flatMap(x => asNodes(x, context)) :
    value instanceof Node ? [value] :
    value instanceof Tag ? [renderClientTag(value, context)] :
    value instanceof Component ? asNodes(...renderComponent(value, context)) :
    isSignal(value) ? signalAsNodes(value, context) :
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
