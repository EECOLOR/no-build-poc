// TODO: escape html
/** @typedef {((...children: Array<string>) => string) | ((attributes: object, ...children: Array<string>) => string)} Tag */

/** @returns {{ html: Tag, head: Tag, body: Tag, div: Tag, script: Tag }} */
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
  return `<${[tagName].concat(renderServerAttributes(attributes)).join(' ')}>${children.join('')}</${tagName}>`
}

function renderClientTag(tagName, attributes, children) {
  /** @type {HTMLElement} */
  const element = document.createElement(tagName)
  Object.entries(attributes).forEach(([k, v]) => {
    if (k.startsWith('on')) element[k.toLowerCase()] = v
    else element.setAttribute(k, v)
  })
  children.forEach(child => {
    const node = (
      typeof child === 'string' ? document.createTextNode(child) :
      child?.get ? signalAsNode(child) :
      child
    )
    element.appendChild(node)
  })
  return element
}

/** @param {import('./signal.js').Signal<any>} signal */
function signalAsNode(signal) {
  let node = document.createTextNode(signal.toString())
  const unsubscribe = signal.subscribe(newValue => {
    const newNode = document.createTextNode(String(newValue))
    node.replaceWith(newNode)
    node = newNode
  })
  return node
}

function renderServerAttributes(attributes) {
  return Object.entries(attributes).map(([k, v]) => `${k}="${v}"`)
}
