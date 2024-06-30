import { createRenderer } from './renderer.js'
import { Signal } from '#ui/signal.js'
import { raw } from '#ui/tags.js'

const escapeHtml = createHtmlEscape()

export const render = createRenderer(
  /** @type {import('./renderer.js').RendererConstructor<string>} */
  ({ renderValue }) => {
    return {
      renderString(value) {
        return value
      },
      renderSignal(signal, context) {
        const result = [].concat(emptyComment(), signal.get(), emptyComment())
        return renderValue(result, context)
      },
      renderTag({ tagName, attributes, children }, context) {
        return (
          `<${[tagName, renderServerAttributes(attributes)].join(' ')}>` +
          renderValue(children, context).join('') +
          `</${tagName}>`
        )
      }
    }
  }
)

function renderServerAttributes(attributes) {
  if (!attributes) return ''

  return Object.entries(attributes)
    .flatMap(([k, v]) => {
      if (typeof k !== 'string') return []

      if (k.startsWith('on')) return []
      if (k === 'className') k = 'class'
      if (k === 'style') v = renderStyles(v)
      const value = v instanceof Signal ? v.get() : v
      return `${k}="${escapeHtml(String(value))}"`
    })
    .join(' ')
}

/** @param {{ [k: string]: string }} styles */
function renderStyles(styles) {
  // TODO: check an implemention like Preact to see if this needs to be more advanced
  return Object.entries(styles)
    .map(([k, v]) => `${k}: ${v};`)
    .join('')
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
