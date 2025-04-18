import { createRenderer } from './renderer.js'
import { createSignal, Signal } from '#ui/signal.js'
import { raw } from '#ui/tags.js'

const escapeHtml = createHtmlEscape()

export const render = createRenderer(
  /** @type {import('./renderer.js').RendererConstructor<string>} */
  ({ renderValue }) => {
    return {
      renderRaw(raw) {
        return [raw.value]
      },
      renderString(value) {
        return escapeHtml(value)
      },
      renderSignal(signal) {
        const value = signal.get()
        const result = [].concat(emptyComment(), value, emptyComment())
        return renderValue(result)
      },
      renderTag({ tagName, attributes, children }) {
        return (
          `<${[tagName, renderServerAttributes(attributes)].join(' ')}>` +
          renderValue(children).join('') +
          `</${tagName}>`
        )
      },
      renderDynamic(dynamic) {
        const value = dynamic.signal.get().map(item => {
          const [$item] = createSignal(item)
          return dynamic.renderItem($item, dynamic.getKey(item))
        })
        const result = [].concat(emptyComment(), value, emptyComment())
        return renderValue(result)
      },
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
      if (k === 'ref') return []
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
