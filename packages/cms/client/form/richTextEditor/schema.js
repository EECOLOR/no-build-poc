import { render } from '#ui/render/clientRenderer.js'
import { createSignal } from '#ui/signal.js'
import { css, Tag, cx } from '#ui/tags.js'
import { Schema } from 'prosemirror-model'
import { Plugin } from 'prosemirror-state'
import { toggleMark, chainCommands, lift } from 'prosemirror-commands'
import { wrapInList, liftListItem, sinkListItem, splitListItem } from 'prosemirror-schema-list'
import { Button, ButtonIndent, ButtonListOl, ButtonListUl, ButtonOutdent } from '#cms/client/ui/Button.js'

/** @import { NodeSpec, MarkSpec } from 'prosemirror-model' */
/** @import { EditorConfig } from './richTextConfig.js' */

const generateUuid = Symbol('generateUuid')
const nodeView = Symbol('nodeView')

schema.node = node
schema.heading = heading
schema.list = list
schema.listItem = listItem
schema.content = content
schema.customComponent = customComponent
schema.nodeViewNode = nodeViewNode
schema.mark = mark
schema.link = link
schema.doc = doc

export const defaultNodes = /** @type {const} */ ({
  heading: schema.heading([1, 2, 3, 4, 5, 6]),
  orderedList: schema.list('ol'),
  unorderedList: schema.list('ul'),
  listItem: schema.listItem(
    schema.content('paragraph', 'orderedList', 'unorderedList')
  ),
})

export const defaultMarks = /** @type {const} */ ({
  link: schema.link(),
  em: schema.mark('em'),
  strong: schema.mark('strong'),
})

/**
 * @param {Schema<any, keyof typeof defaultMarks>} schema
 */
export function defaultMarkConfigs(schema) {
  return /** @type {const} */ ([
    {
      type: 'mark',
      mark: schema.marks.strong,
      title: 'Bold',
      command: toggleMark(schema.marks.strong),
      shortcut: 'Mod-b',
      Component: MarkStrong,
    },
    {
      type: 'mark',
      mark: schema.marks.em,
      title: 'Italic',
      command: toggleMark(schema.marks.em),
      shortcut: 'Mod-i',
      Component: MarkEm,
    }
  ])
}

// TODO: we probably want a typed wrapper for Schema, it's `nodes` is of type any
/**
 * @param {Schema<keyof typeof defaultNodes, any>} schema
 */
export function defaultNodeConfigs(schema) {

  return /** @type {const} */ ([
    {
      type: 'node',
      node: schema.nodes.orderedList,
      title: 'Ordered list',
      command: chainCommands(
        unwrapFromList(schema.nodes.orderedList),
        wrapInList(schema.nodes.orderedList)
      ),
      shortcut: 'Shift-Mod-7',
      Component: OrderedList,
    },
    {
      type: 'node',
      node: schema.nodes.unorderedList,
      title: 'Unordered list',
      command: chainCommands(
        unwrapFromList(schema.nodes.unorderedList),
        wrapInList(schema.nodes.unorderedList),
      ),
      shortcut: 'Shift-Mod-8',
      Component: UnorderedList,
    },
    {
      type: 'node',
      node: schema.nodes.listItem,
      title: 'Outdent list item',
      command: liftListItem(schema.nodes.listItem),
      shortcut: 'Shift-Tab',
      Component: Outdent,
    },
    {
      type: 'node',
      node: schema.nodes.listItem,
      title: 'Indent list item',
      command: sinkListItem(schema.nodes.listItem),
      shortcut: 'Tab',
      Component: Indent,
    },
    {
      type: 'node',
      node: schema.nodes.listItem,
      title: 'Generic list functionality',
      command: splitListItem(schema.nodes.listItem),
      shortcut: 'Enter',
    }
  ])
}

/**
 * @template {Schema} T
 * @param {T} schema
 * @param {Array<EditorConfig<T>>} configs
 */
export function editorConfigsWithDefaults(schema, configs) {
  return [
    ...defaultEditorConfigs(schema),
    ...configs
  ]
}

/**
 * @param {Schema<keyof typeof defaultNodes, keyof typeof defaultMarks>} schema
 */
export function defaultEditorConfigs(schema) {
  return [
    ...defaultNodeConfigs(schema),
    ...defaultMarkConfigs(schema),
  ]
}

export const defaultSchema = schema({ nodes: defaultNodes, marks: defaultMarks })

/**
 * @template {string} [Nodes = never]
 * @template {string} [Marks = never]
 * @param {{
*   nodes?: { [name in Nodes]: NodeSpec }
*   marks?: { [name in Marks]: MarkSpec }
* }} customSchema
*/
export function schemaWithDefaults(customSchema) {
  return schema({
    nodes: {
      ...defaultNodes,
      ...customSchema.nodes,
    },
    marks: {
      ...defaultMarks,
      ...customSchema.marks,
    },
  })
}

/**
 * @template {string} [Nodes = never]
 * @template {string} [Marks = never]
 * @param {{
 *   nodes?: { [name in Nodes]: NodeSpec }
 *   marks?: { [name in Marks]: MarkSpec }
 * }} customSchema
 */
export function schema(customSchema) {

  // TODO: add a handler for unknown nodes (for when content is copy pasted): https://github.com/ueberdosis/tiptap/pull/5178/files
  return new Schema({
    nodes: {
      doc: schema.doc(
        schema.content('paragraph', 'unknown', Object.keys(customSchema?.nodes || {})),
      ),
      text: {},
      paragraph: schema.node('p', { content: 'text*' }),
      ...customSchema.nodes,
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
    },
    marks: {
      ...customSchema.marks,
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
  /** @type {Map<NodeSpec, { attributeName: string }>} */
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
  return Object.fromEntries(
    Object.entries(schema.nodes).map(([name, node]) =>
      [name, node.spec[nodeView]] // https://github.com/ProseMirror/prosemirror-model/commit/c8c7b62645d2a8293fa6b7f52aa2b04a97821f34#r148502417
    )                             // if link does not jump (https://github.com/orgs/community/discussions/139005#discussioncomment-11092579)
  )                               // src/schema.ts line 432
}

/**
 * @param {string} tag
 * @param {Exclude<NodeSpec, 'toDOM' | 'parseDOM'>} spec
 * @returns {NodeSpec}
 */
 function node(tag, spec) {
  return {
    toDOM() { return /** @const */ ([tag, 0]) },
    parseDOM: [{ tag }],
    ...spec,
  }
}

/**
 * @param {Array<number>} variants
 * @param {NodeSpec} [spec]
 */
function heading(variants = [1, 2, 3, 4, 5, 6], spec) {
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
 * @param {Partial<NodeSpec>} [spec]
 */
function list(type, spec) {
  return schema.node(type, { content: 'listItem+', ...spec })
}

/**
 * @param {string} content
 * @param {Partial<NodeSpec>} [spec]
*/
function listItem(content, spec) {
  return schema.node('li', { content, ...spec })
}

function content(...nodeTypes) {
  return `(${nodeTypes.flat().join(' | ')})+`
}

/**
 * @param {string} name
 * @param {(props: { id: string, $selected }) => Tag<any>} Component
 */
function customComponent(name, Component) {
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
function nodeViewNode(name, nodeViewConstructor) {
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
 * @param {string} tag
 * @param {MarkSpec} [spec]
*/
function mark(tag, spec) {
  return {
    toDOM() { return /** @type const */ ([tag, 0]) },
    parseDOM: [{ tag }],
    ...spec,
  }
}

function link(spec) {
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

/**
 * @param {string} content
 */
function doc(content) {
  return {
    content,
    attrs: {
      version: { default: 0 },
      lastEditClientId: { default: '' },
    },
  }
}

// TODO: move to generic utils / machinery
function unwrapFromList(nodeType) {
  return (state, dispatch, view) => {
    const {$from, $to} = state.selection
    const range = $from.blockRange($to, node => node.type === nodeType)
    if (!range) return false

    return lift(state, dispatch, view)
  }
}

// TODO: move to generic utils / machinery
export function inject(nodeType) {
  return (state, dispatch, view) => {
    if (dispatch)
      dispatch(
        state.tr.replaceSelectionWith(
          nodeType.create(null, [nodeType.schema.text('[this text can be edited]')])
        )
      )
    return true
  }
}

MarkStrong.style = css`
  font-weight: bold;
`
function MarkStrong({ config, $enabled, $active, onClick }) {
  return Mark({ label: 'B', css: MarkStrong.style, config, $enabled, $active, onClick })
}

MarkEm.style = css`
  font-style: italic;
`
function MarkEm({ config, $enabled, $active, onClick }) {
  return Mark({ label: 'I', css: MarkEm.style, config, $enabled, $active, onClick })
}

Mark.style = css`
  width: 2em;
  height: 2em;
  &.active {
    background-color: gainsboro;
  }
`
function Mark({ label, css, config, $enabled, $active, onClick }) {
  return Button(
    {
      css: [Mark.style, css],
      className: cx('Mark', $active.derive(active => active && 'active')),
      onClick,
      label,
      disabled: $enabled.derive(x => !x),
      title: config.title,
    },
  )
}

// TODO: combine with Mark as a MenuButton
OrderedList.style = css`
  --width: 2em;
  --height: 2em;
  &.active {
    background-color: gainsboro;
  }
`
function OrderedList({ config, $enabled, $active, onClick }) {
  return IconButton({ button: ButtonListOl, config, $enabled, $active, onClick })
}

function UnorderedList({ config, $enabled, $active, onClick }) {
  return IconButton({ button: ButtonListUl, config, $enabled, $active, onClick })
}

function Indent({ config, $enabled, $active, onClick }) {
  return IconButton({ button: ButtonIndent, config, $enabled, onClick })
}

function Outdent({ config, $enabled, $active, onClick }) {
  return IconButton({ button: ButtonOutdent, config, $enabled, onClick })
}

IconButton.style = css`
  --width: 2em;
  --height: 2em;
  &.active {
    background-color: gainsboro;
  }
`
function IconButton({ button, config, $enabled, $active = undefined, onClick }) {
  return button(
    {
      css: IconButton.style,
      className: cx('IconButton', $active?.derive(active => active && 'active')),
      onClick,
      disabled: $enabled.derive(x => !x),
      title: config.title,
    },
  )
}
