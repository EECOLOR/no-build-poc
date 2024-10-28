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
      renderRaw(raw, context) {
        const { value } = raw
        return value instanceof Node ? [value] : renderValue(value, context)
      },
      renderString(value) {
        return document.createTextNode(value)
      },
      renderSignal(signal, context) {
        const marker = comment()
        const value = [].concat(raw(marker), signal.get(), raw(comment()))
        const nodes = renderValue(value, context)

        const unsubscribe = signal.subscribeDirect(newValue => {
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
          try {
            // TODO: make sure key is unique for all individual items
            const key = dynamic.getKey(item, i, items)
            return renderItem(key, item, i, items)
          } catch (e) {
            throw `Problem rendering dynamic:\n${e.message}\n${dynamic.signal.stack}\nTrigger:\n${e.stack}`
          }
        })
        const nodes = [marker, ...nodesFromLoop, comment()]

        const unsubscribe = dynamic.signal.subscribeDirect(newItems => {
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
        const subscriptions = []

        let ref = null

        if (attributes)
          for (const [k, v] of Object.entries(attributes)) {
            if (typeof k !== 'string') return

            if (k.startsWith('on')) element[k.toLowerCase()] = v
            else if (v instanceof Signal) subscriptions.push(bindSignalToAttribute(element, k, v))
            else if (k === 'style') subscriptions.push(...applyStyles(element.style, v))
            else if (k === 'ref') /** @type {typeof element[k]} */ (ref = v)(element)
            else setAttributeOrProperty(element, k, v)
          }

        const nodes = children.flatMap(x => renderValue(x, context))

        for (const node of nodes) {
          if (isTemplateTag(tagName)) handleTemplateTagChild(element, node)
          else if (isTemplateNode(node)) handleTemplateAsChild(element, node)
          else element.appendChild(node)
        }

        if (subscriptions.length || ref)
          useOnDestroy(() => {
            for (const unsubscribe of subscriptions) unsubscribe()
            if (ref) ref(null)
          })

        return element
      }
    }
  }
)

function applyStyles(style, styles) {
  const subscriptions = []
  for (const [k, v] of Object.entries(styles)) {
    if (v instanceof Signal) subscriptions.push(bindSignalToStyle(style, k, v))
    else setStyleOrProperty(style, k, v)
  }
  return subscriptions
}

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

function setAttributeOrPropertyInDom(element, k, v) {
  if (v === undefined) return
  writeToDom.outsideAnimationFrame(setAttributeOrProperty.bind(null, element, k, v))
}

function setAttributeOrProperty(element, k, v) {
  if (v === undefined) return

  if (k in element) element[k] = v
  else element.setAttribute(k, v)
}

function setStyleOrPropertyInDom(style, k, v) {
  writeToDom.outsideAnimationFrame(setStyleOrProperty.bind(null, style, k, v))
}

function setStyleOrProperty(style, k, v) {
  if (k.startsWith('--')) style.setProperty(k, v)
  else style[k] = v
}

function bindSignalToStyle(style, k, signal) {
  setStyleOrProperty(style, k, signal.get())
  return bindSignalTo(signal, setStyleOrPropertyInDom.bind(null, style, k))
}

function bindSignalToAttribute(element, attribute, signal) {
  setAttributeOrProperty(element, attribute, signal.get())
  return bindSignalTo(signal, setAttributeOrPropertyInDom.bind(null, element, attribute))
}

function bindSignalTo(signal, setValue) {
  const unsubscribe = signal.subscribeDirect(setValue)
  return unsubscribe
}

function swapNodesInDom(marker, newNodes, oldNodes) {
  writeToDom.outsideAnimationFrame(() => {

    for (const oldNode of oldNodes) {
      if (!newNodes.includes(oldNode))
        oldNode.remove()
    }

    let current = marker
    for (const i in newNodes) {
      const newNode = newNodes[i]

      if (current.nextSibling !== newNode)
        current.after(newNode)

      current = newNode
    }
  })
}

function comment() {
  return document.createComment('')
}
