import { Component } from './component.js'
import { isSignal } from './signal.js'
import { emptyValues, raw, Raw, Tag } from './tags.js'

const escapeHtml = createHtmlEscape()

/**
 * @template {import('./tags.js').TagNames} T
 * @param {Tag<T>} tag
 * @returns {string}
 */
export function renderServerTag({ tagName, attributes, children }) {
  return (
    `<${[tagName, renderServerAttributes(attributes)].join(' ')}>` +
    asEncoded(children) +
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
function asEncoded(value) {
  return (
    emptyValues.includes(value) ? '' :
    Array.isArray(value) ? value.map(asEncoded).join('') :
    isSignal(value) ? asEncoded([emptyComment()].concat(value.get())) :
    value instanceof Raw ? value.value :
    value instanceof Tag ? renderServerTag(value) :
    value instanceof Component ? asEncoded(renderComponent(value)) :
    escapeHtml(String(value))
  )
}

function renderComponent({ constructor, props, children }) {
  const params = props ? [props].concat(children) : children
  return constructor(...params)
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
