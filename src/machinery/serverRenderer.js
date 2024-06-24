import { Component, renderComponent } from './component.js'
import { isSignal } from './signal.js'
import { emptyValues, raw, Raw, Tag } from './tags.js'

const escapeHtml = createHtmlEscape()

/**
 * @template {Tag<any> | Component<any>} T
 * @param {T} tagOrComponent
 * @returns {string}
 */
export function render(tagOrComponent) {
  return (
    tagOrComponent instanceof Component ? asEncoded(...renderComponent(tagOrComponent, {})) :
    tagOrComponent instanceof Tag ? renderServerTag(tagOrComponent, {}) :
    throwError(`Can only render tags and components`)
  )
}

/** @returns {never} */
function throwError(message) { throw new Error(message) }

function renderServerTag({ tagName, attributes, children }, context) {
  return (
    `<${[tagName, renderServerAttributes(attributes)].join(' ')}>` +
    asEncoded(children, context) +
    `</${tagName}>`
  )
}

function renderServerAttributes(attributes) {
  if (!attributes) return ''

  return Object.entries(attributes)
    .flatMap(([k, v]) => {
      if (k.startsWith('on')) return []
      if (k === 'className') k = 'class'
      if (k === 'style') v = renderStyles(v)
      const value = isSignal(v) ? v.get() : v
      return `${k}="${escapeHtml(String(value))}"`
    })
    .join(' ')
}

function renderStyles(styles) {
  // TODO: check an implemention like Preact to see if this needs to be more advanced
  return Object.entries(styles)
    .map(([k, v]) =>
      `${k}: ${v};`
    )
    .join('')
}

/** @returns {string} */
function asEncoded(value, context) {
  return (
    emptyValues.includes(value) ? '' :
    Array.isArray(value) ? value.map(x => asEncoded(x, context)).join('') :
    isSignal(value) ? asEncoded([emptyComment()].concat(value.get()), context) :
    value instanceof Raw ? value.value :
    value instanceof Tag ? renderServerTag(value, context) :
    value instanceof Component ? asEncoded(...renderComponent(value, context)) :
    escapeHtml(String(value))
  )
}

function emptyComment() {
  return raw('<!---->')
}

// This can be faster, check the source of Preact for a faster version
function createHtmlEscape() {
  const escapeRegex = /[&<>'"]/g
  const escapeLookup = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }

  return function escape(str) {
    return str.replace(escapeRegex, escapeFunction)
  }

  function escapeFunction(match) {
    return escapeLookup[match]
  }
}
