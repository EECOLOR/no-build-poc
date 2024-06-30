import { writeToDom } from './domInteraction.js'
import { createRenderer } from './renderer.js'
import { Signal } from './signal.js'
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
        let nodes = renderValue([].concat(raw(marker), signal.get(), raw(comment())), context)

        const unsubscribe = signal.subscribe(newValue => {
          if (!marker.isConnected) return unsubscribe()

          const newNodes = renderValue(newValue, context)
          const oldNodes = nodes.slice(1, -1)

          swapNodes(marker, newNodes, oldNodes)

          nodes.splice(1, oldNodes.length, ...newNodes)
        })

        return nodes
      },
      renderTag({ tagName, attributes, children }, context) {
        const element = document.createElement(tagName)

        if (attributes)
          Object.entries(attributes).forEach(([k, v]) => {
            if (typeof k !== 'string') return

            if (k.startsWith('on')) element[k.toLowerCase()] = v
            else if (v instanceof Signal) bindSignalToAttribute(element, k, v)
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

  const unsubscribe = signal.subscribe(value => {
    if (!element.isConnected) return unsubscribe()

    writeToDom.outsideAnimationFrame(() => {
      setAttributeOrProperty(element, attribute, value)
    })
  })
}

function swapNodes(marker, newNodes, oldNodes) {
  writeToDom.outsideAnimationFrame(() => {
    oldNodes.forEach((node, i) => { // A normal loop would probably be better
      const replacementNode = newNodes[i]
      if (replacementNode) node.replaceWith(replacementNode)
      else node.remove()
    })
    const leftOverNewNodes = newNodes.slice(oldNodes.length)

    const lastNode = newNodes[oldNodes.length - 1] || marker
    lastNode.after(...leftOverNewNodes)
  })
}

function comment() {
  return document.createComment('')
}

const emptyArray = []
function combineTextNodes(nodes) {
  return nodes.flatMap((node, i) => {
    if (!i || node.nodeType !== Node.TEXT_NODE)
      return [node]

    const previous = nodes[i - 1]
    if (previous.nodeType !== Node.TEXT_NODE)
      return [node]

    previous.nodeValue += node.nodeValue || ' '
    return emptyArray
  })
}
