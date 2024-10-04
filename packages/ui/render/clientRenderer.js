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
          try {
            const newNodes = renderValue(newValue, context)
            const oldNodes = nodes.slice(1, -1)

            swapNodesInDom(marker, newNodes, oldNodes)

            nodes.splice(1, oldNodes.length, ...newNodes)
          } catch (e) {
            throw `Problem rendering signal:\n${e.message}\n${signal.stack}`
          }
        })
        useOnDestroy(unsubscribe)

        return nodes
      },
      renderDynamic(dynamic, context) {
        const marker = comment()
        const infoByKey = new Map()
        const nodesFromLoop = dynamic.signal.get().flatMap((item, i, items) => {
          const key = dynamic.getKey(item, i, items)
          return renderItem(key, item, i, items)
        })
        const nodes = [marker, ...nodesFromLoop, comment()]

        const unsubscribe = dynamic.signal.subscribe(newItems => {
          const unusedKeys = new Set(infoByKey.keys())
          const oldNodes = nodes.slice(1, -1)
          const newNodes = newItems.flatMap((item, i, items) => {
            const key = dynamic.getKey(item, i, items)
            unusedKeys.delete(key)
            return infoByKey.has(key) ? infoByKey.get(key).nodes : renderItem(key, item, i, items)
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

        function renderItem(key, item, i, items) {
          const [nodes, callbacks] = withOnDestroyCapture(() => {
            const rendered = dynamic.renderItem(item, i, items)
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

        for (const node of nodes) {
          if (isTemplateTag(tagName)) handleTemplateTagChild(element, node)
          else if (isTemplateNode(node)) handleTemplateAsChild(element, node)
          else element.appendChild(node)
        }

        return element
      }
    }
  }
)

function isTemplateTag(tagName) {
  return tagName === 'template'
}
function handleTemplateTagChild(template, child) {
  template.content.appendChild(child)
}

function isTemplateNode(node) {
  return node.nodeName === 'TEMPLATE'
}
function handleTemplateAsChild(element, template) {
  const shadowRoot = element.attachShadow({ mode: template.getAttribute('shadowrootmode') })
  shadowRoot.appendChild(template.content)
}

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
  const { activeElement } = document
  writeToDom.outsideAnimationFrame(() => {
    let oldNodesLength = oldNodes.length
    while (oldNodesLength--) {
      const oldNode = oldNodes[oldNodesLength]
      if (!newNodes.includes(oldNode))
        oldNode.remove()
    }
    marker.after(...newNodes)
    if (activeElement?.isConnected && activeElement instanceof HTMLElement)
      activeElement.focus()
  })
}

function comment() {
  return document.createComment('')
}
