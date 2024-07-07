import { writeToDom } from '#ui/domInteraction.js'
import { createRenderer } from './renderer.js'
import { Signal } from '#ui/signal.js'
import { raw } from '#ui/tags.js'

/** @typedef {import('#ui/tags.js').TagNames} TagNames */

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
          for (const [k, v] of Object.entries(attributes)) {
            if (typeof k !== 'string') return

            if (k.startsWith('on')) element[k.toLowerCase()] = v
            else if (v instanceof Signal) bindSignalToAttribute(element, k, v)
            else if (k === 'style') Object.assign(element.style, v)
            else setAttributeOrProperty(element, k, v)
          }

        const nodes = children.flatMap(x => renderValue(x, context))
        for (const node of nodes) element.appendChild(node)

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
    let oldNodesLength = oldNodes.length
    while (oldNodesLength--) {
      const oldNode = oldNodes[oldNodesLength]
      oldNode.remove()
    }
    marker.after(...newNodes)
  })
}

function comment() {
  return document.createComment('')
}
