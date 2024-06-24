import { writeToDom } from './domInteraction.js'
import { createRenderer } from './renderer.js'
import { isSignal } from './signal.js'
import { raw } from './tags.js'

/** @typedef {import('./tags.js').TagNames} TagNames */

/**
 * @template {TagNames} key
 * @typedef {key extends any ? HTMLElement :
 *  JSX.IntrinsicElements[key] extends React.DetailedHTMLProps<infer Y, infer X> ? X : never
 * } HtmlElementFor
 */

 export const render = createRenderer(
  /** @type {import('./renderer.js').RendererConstructor<Node>} */
  ({ renderValue }) => {
    return {
      renderString(value) {
        return document.createTextNode(value)
      },
      renderSignal(signal, context) {
        const marker = comment()
        let nodes = renderValue([].concat(raw(marker), signal.get()), context)

        // TODO: unsubscribe when element is removed
        const unsubscribe = signal.subscribe(newValue => {
          const newNodes = renderValue(newValue, context)
          const oldNodes = nodes.slice(1)

          swapNodes(marker, newNodes, oldNodes)

          nodes.splice(1, Infinity, ...newNodes)
        })

        return nodes
      },
      renderTag({ tagName, attributes, children }, context) {
        const element = document.createElement(tagName)

        if (attributes)
          Object.entries(attributes).forEach(([k, v]) => {
            if (k.startsWith('on')) element[k.toLowerCase()] = v
            else if (isSignal(v)) bindSignalToAttribute(element, k, v)
            else if (k === 'style') Object.assign(element.style, v)
            else setAttributeOrProperty(element, k, v)
          })

        const nodes = combineTextNodes(children.flatMap(x => renderValue(x, context)))
        nodes.forEach(node => { element.appendChild(node) })

        return element
      }
    }
  }
)

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
