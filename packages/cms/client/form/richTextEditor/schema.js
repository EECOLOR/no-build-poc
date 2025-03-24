import { render } from '#ui/render/clientRenderer.js'
import { createSignal } from '#ui/signal.js'
import { Tag } from '#ui/tags.js'
import { Schema } from 'prosemirror-model'
import { Plugin } from 'prosemirror-state'

// move to RichTextEditor and use plugin with appendTransaction to assign uuid (https://discuss.prosemirror.net/t/how-i-can-attach-attribute-with-dynamic-value-when-new-paragraph-is-inserted/751/3)
export const generateUuid = Symbol('generateUuid')
export const nodeView = Symbol('nodeView')

/**
 * @template {string} Nodes
 * @template {string} Marks
 * @param {{
 *  nodes?: { [name: string]: import('prosemirror-model').NodeSpec }
 *  marks?: { [name: string]: import('prosemirror-model').MarkSpec }
 * }} spec
 */
export function schema({ nodes = {}, marks = {} } = {}) {

  // TODO: add a handler for unknown nodes (for when content is copy pasted): https://github.com/ueberdosis/tiptap/pull/5178/files
  return new Schema({
    nodes: {
      doc: schema.doc(
        schema.content('paragraph', 'orderedList', 'unorderedList', 'heading', 'unknown', Object.keys(nodes)),
      ),
      text: {},
      paragraph: schema.node('p'),
      heading: schema.heading([1, 2, 3, 4, 5, 6]),
      orderedList: schema.list('ol'),
      unorderedList: schema.list('ul'),
      listItem: schema.listItem(
        schema.content('paragraph', 'orderedList', 'unorderedList')
      ),
      unknown: {
        attrs: { node: {} },
        atom: true,
        toDOM(node) {
          return ['pre', { style: 'background-color: lightcoral outline: 2px solid black'},
            `Unknown node type:\n${JSON.stringify(node.attrs.node, null, 2)}`
          ]
        },
        parseDOM: [{ tag: '*', priority: 0 }],
      },

      ...nodes,
    },
    marks: {
      link: schema.link(),
      em: schema.mark('em'),
      strong: schema.mark('strong'),

      ...marks,
    }
  })
}

export function schemaPlugins(schema) {
  return [
    createUuidPlugin.isNeededFor(schema) && createUuidPlugin(schema)
  ].filter(Boolean)
}

/** @param {Schema} schema */
createUuidPlugin.isNeededFor = function isNeededFor(schema) {
  return Object.values(schema.nodes).some(x => x.spec.hasOwnProperty(generateUuid))
}

function createUuidPlugin(schema) {
  /** @type {Map<import('prosemirror-model').NodeSpec, { attributeName: string }>} */
  const targetTypes = new Map(getApplicableEntries(schema.nodes)) // get from schema
  return new Plugin({
    appendTransaction(transactions, prevState, nextState) {

      if (transactions.some((transaction) => transaction.docChanged))
        return null

      let { tr } = nextState
      let modified = false
      nextState.doc.descendants((node, pos) => {
        if (!targetTypes.has(node.type))
          return

        const { attributeName } = targetTypes.get(node.type)
        if (nodeHasAttribute(node, attributeName))
          return

        tr.setNodeMarkup(pos, undefined, {...node.attrs, [attributeName]: createUuid()})
        modified = true
      })

      return modified ? tr : null
    },
  })

  /** @param {Schema['nodes']} nodes */
  function getApplicableEntries(nodes) {
    return Object.values(nodes).flatMap(node =>
      node.spec.hasOwnProperty(generateUuid) ? [/** @type const */([node, node.spec[generateUuid]])] : [] // ts error is because the type definition uses { [name: string]: ... }
    )
  }

  function nodeHasAttribute(node, attrName) {
    return node.attrs && node.attrs[attrName]
  }

  function createUuid() {
    return window.crypto.randomUUID()
  }
}

export function extractNodeViews(schema) {
  // TODO: fill in
}

/**
 * @param {string} tag
 * @param {Partial<import('prosemirror-model').NodeSpec>} [spec]
 */
 schema.node = function node(tag, spec) {
  return schema.tag(tag, { content: 'text*', ...spec })
}

/**
 * @param {Array<number>} variants
 * @param {import('prosemirror-model').NodeSpec} [spec]
 */
schema.heading = function heading(variants = [1, 2, 3, 4, 5, 6], spec) {
  return {
    content: 'text*',
    defining: true,
    attrs: { level: { default: 1, validate: 'number' } },
    toDOM(node) { return /** @type const */ ([`h${node.attrs.level}`, 0]) },
    parseDOM: variants.map(variant => ({ tag: `h${variant}`, attrs: { level: variant } })),
    ...spec,
  }
}

/**
 * @param {'ol' | 'ul'} type
 * @param {Partial<import('prosemirror-model').NodeSpec>} [spec]
 */
schema.list = function list(type, spec) {
  return schema.node(type, { content: 'listItem+', ...spec })
}

/**
 * @param {string} content
 * @param {Partial<import('prosemirror-model').NodeSpec>} [spec]
 */
schema.listItem = function listItem(content, spec) {
  return schema.node('li', { content, ...spec })
}

schema.content = function content(...nodeTypes) {
  return `(${nodeTypes.flat().join(' | ')})+`
}

/**
 * @param {string} name
 * @param {({ id: string, $selected }) => Tag<any>} Component
 */
schema.customComponent = function createCustomNodeView(name, Component) {
  return schema.nodeViewNode(name, node => {
    const [$selected, setSelected] = createSignal(false)

    const { result, destroy } = render(() => Component({ id: node.attrs.id, $selected }))

    const [dom, ...rest] = result
    if (rest.length)
      throw new Error(`Component '${Component.name}' should return a single DOM node`)

    return {
      dom,
      destroy,
      selectNode() { setSelected(true) },
      deselectNode() { setSelected(false) },
    }
 })
}

/**
 * @param {string} name
 * @param {import('prosemirror-view').NodeViewConstructor} nodeViewConstructor
 */
schema.nodeViewNode = function(name, nodeViewConstructor) {
  // TODO: if you place more blocks directly after each other, you can no longer place cursor in between
  return {
    atom: true,
    inline: false,
    marks: '', // disallow marks

    attrs: { id: { validate: 'string|null|undefined' } },
    toDOM(node) { return /** @type const */ ([`custom-${name}`, { id: node.attrs.id }]) },
    parseDOM: [{
      tag: `custom-${name}`,
      getAttrs(dom) { return { id: dom.getAttribute('id') } },
    }],

    [nodeView]: nodeViewConstructor,
    [generateUuid]: { attributeName: 'id' },
  }
}

/**
 * @template {import('prosemirror-model').MarkSpec | import('prosemirror-model').NodeSpec} T
 * @param {string} tag
 * @param {T} [spec]
 */
schema.tag = function tag(tag, spec) {
  return {
    toDOM() { return [tag, 0] },
    parseDOM: [{ tag }],
    ...spec,
  }
}

/**
 * @param {string} tag
 * @param {import('prosemirror-model').MarkSpec} [spec]
 */
schema.mark = function mark(tag, spec) {
  return schema.tag(tag, spec)
}

schema.link = function link(spec) {
  return {
    inclusive: false,

    attrs: { href: { validate: 'string' } },
    toDOM(node) { return /** @type const */ (['a', { href: node.attrs.href }, 0]) },
    parseDOM: [{
      tag: 'a[href]',
      getAttrs(dom) { return { href: dom.getAttribute('href') } },
    }],
  }
}

schema.doc = function doc(content) {
  return { content }
}
