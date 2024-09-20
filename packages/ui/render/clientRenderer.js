import { writeToDom } from '#ui/domInteraction.js'
import { createRenderer } from './renderer.js'
import { Signal } from '#ui/signal.js'
import { raw } from '#ui/tags.js'
import { useOnDestroy, withOnDestroyCapture } from '#ui/dynamic.js'

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
        const value = [].concat(raw(marker), signal.get(), raw(comment()))
        const nodes = renderValue(value, context)

        const unsubscribe = signal.subscribe(newValue => {
          const newNodes = renderValue(newValue, context)
          const oldNodes = nodes.slice(1, -1)

          swapNodesInDom(marker, newNodes, oldNodes)

          nodes.splice(1, oldNodes.length, ...newNodes)
        })
        useOnDestroy(unsubscribe)

        return nodes
      },
      renderLoop(loop, context) {
        const marker = comment()
        const infoByKey = new Map()
        const nodesFromLoop = loop.signal.get().flatMap(item => {
          const key = loop.getKey(item)
          return renderItem(key, item)
        })
        const nodes = [marker, ...nodesFromLoop, comment()]

        const unsubscribe = loop.signal.subscribe(newItems => {
          const unusedKeys = new Set(infoByKey.keys())
          const oldNodes = nodes.slice(1, -1)
          const newNodes = newItems.flatMap(item => {
            const key = loop.getKey(item)
            unusedKeys.delete(key)
            return infoByKey.has(key) ? infoByKey.get(key).nodes : renderItem(key, item)
          })

          for (const key of unusedKeys) {
            for (const callback of infoByKey.get(key).callbacks) callback()
            infoByKey.delete(key)
          }

          swapNodesInDom(marker, newNodes, oldNodes)

          nodes.splice(1, oldNodes.length, ...newNodes)
        })

        useOnDestroy(() => {
          unsubscribe()
          for (const info of infoByKey.values()) {
            for (const callback of info.callbacks) callback()
          }
          infoByKey.clear()
        })

        return nodes

        function renderItem(key, item) {
          const [nodes, callbacks] = withOnDestroyCapture(() => {
            const rendered = loop.renderItem(item)
            return renderValue(rendered, context)
          })
          infoByKey.set(key, { callbacks, nodes })
          return nodes
        }
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

function swapNodesInDom(marker, newNodes, oldNodes) {
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