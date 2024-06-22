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
  return Object.entries(attributes)
    .flatMap(([k, v]) => {
      if (k.startsWith('on')) return []
      if (k === 'className') k = 'class'
      const value = isSignal(v) ? v.get() : v
      return `${k}="${escapeHtml(String(value))}"`
    })
    .join(' ')
}

/** @returns {string} */
function asEncoded(value) {
  return (
    emptyValues.includes(value) ? '' :
    Array.isArray(value) ? value.map(asEncoded).join('') :
    isSignal(value) ? asEncoded([emptyComment()].concat(value.get())) :
    value instanceof Raw ? value.value :
    value instanceof Tag ? renderServerTag(value) :
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