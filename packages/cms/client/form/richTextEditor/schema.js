import { render } from '#ui/render/clientRenderer.js'
import { createSignal, Signal } from '#ui/signal.js'
import { css, Tag, cx, tags } from '#ui/tags.js'
import { Schema } from 'prosemirror-model'
import { EditorState, Plugin } from 'prosemirror-state'
import { toggleMark, chainCommands, lift, setBlockType } from 'prosemirror-commands'
import { wrapInList, liftListItem, sinkListItem, splitListItem } from 'prosemirror-schema-list'
import { Button, ButtonIndent, ButtonListOl, ButtonListUl, ButtonOutdent } from '#cms/client/ui/Button.js'

/** @import { NodeSpec, MarkSpec, MarkType, NodeType, Node, Mark } from 'prosemirror-model' */
/** @import { EditorConfig, EditorConfigBase, EditorConfigGroup, EditorConfigMark, EditorConfigNode } from './richTextConfig.js' */
/** @import { Command } from 'prosemirror-state' */
/** @import { Attributes } from '#ui/tags.js' */

const generateUuid = Symbol('generateUuid')
const nodeView = Symbol('nodeView')

const {
  select,
  button,
  option,
  span,
  // @ts-expect-error TODO: add selectedcontent to global types
  selectedcontent,
} = tags

schema.paragraph = paragraph
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
      /** @arg {EditorState} state */
      isActive: state => isMarkActive(state, schema.marks.strong),
      shortcut: 'Mod-b',
      Component: MarkStrong,
    },
    {
      type: 'mark',
      mark: schema.marks.em,
      title: 'Italic',
      command: toggleMark(schema.marks.em),
      /** @arg {EditorState} state */
      isActive: state => isMarkActive(state, schema.marks.em),
      shortcut: 'Mod-i',
      Component: MarkEm,
    }
  ])
}

// TODO: we probably want a typed wrapper for Schema, it's `nodes` is of type any <- this is not allways the case
// TODO: we probably want a typed wrapper for NodeType in nodes of schema, it would be nice to have type completion for attributes
/**
 * @param {Schema<keyof typeof defaultNodes | 'paragraph', any>} schema
 */
export function defaultNodeConfigs(schema) {

  return /** @type {const} */ ([
    {
      type: 'group',
      title: 'Style',
      items: [
        {
          type: 'node',
          node: schema.nodes.paragraph,
          command: setBlockType(schema.nodes.paragraph),
          /** @arg {EditorState} state */
          isActive: state => isNodeActive(state, schema.nodes.paragraph),
          title: 'Normal',
          Component: Normal,
        },
        ...Array.from(Array(3), /** @arg {0 | 1 | 2} i*/ (_, i) => {
          const h = /** @type {2 | 3 | 4} */ (i + 2)

          return /** @type {const} */ ({
            type: 'node',
            node: schema.nodes.heading,
            command: setBlockType(schema.nodes.heading, { level: h }),
            /** @arg {EditorState} state */
            isActive: state => isNodeActive(state, schema.nodes.heading, { level: h }),
            title: `H${h}`,
            Component: createHeadingComponent(h),
          })
        }),
      ],
      Component: Select,
    },
    {
      type: 'node',
      node: schema.nodes.orderedList,
      title: 'Ordered list',
      command: chainCommands(
        unwrapFromList(schema.nodes.orderedList),
        wrapInList(schema.nodes.orderedList)
      ),
      /** @arg {EditorState} state */
      isActive: state => isListActive(state, schema.nodes.orderedList),
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
      /** @arg {EditorState} state */
      isActive: state => isListActive(state, schema.nodes.unorderedList),
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
 * @param {ReadonlyArray<EditorConfig<T>>} configs
 */
export function editorConfigsWithDefaults(schema, configs) {
  return [
    ...defaultEditorConfigs(schema),
    ...configs
  ]
}

/**
 * @param {Schema<keyof typeof defaultNodes | 'paragraph', keyof typeof defaultMarks>} schema
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
 *   nodes?: { [name in Nodes]: NodeSpec } & { paragraph?: NodeSpec }
 *   marks?: { [name in Marks]: MarkSpec }
 * }} customSchema
 */
export function schema(customSchema) {

  // TODO: add a handler for unknown nodes (for when content is copy pasted): https://github.com/ueberdosis/tiptap/pull/5178/files
  return new Schema({
    nodes: {
      doc: schema.doc(
        schema.content('paragraph', 'unknown', ...Object.keys(customSchema?.nodes || {})),
      ),
      text: {},
      paragraph: schema.paragraph(),
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

/** @arg {Schema} schema */
export function schemaPlugins(schema) {
  return [
    createUuidPlugin.isNeededFor(schema) && createUuidPlugin(schema)
  ].filter(Boolean)
}

/** @arg {Schema} schema */
createUuidPlugin.isNeededFor = function isNeededFor(schema) {
  return Object.values(schema.nodes).some(x => x.spec.hasOwnProperty(generateUuid))
}

/** @arg {Schema} schema */
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

  /** @arg {Schema['nodes']} nodes */
  function getApplicableEntries(nodes) {
    return Object.values(nodes).flatMap(node => node.spec.hasOwnProperty(generateUuid)
      // @ts-expect-error ts error is because the type definition uses { [name: string]: ... }
      ? [/** @type const */([node, node.spec[generateUuid]])]
      : []
    )
  }

  /** @arg {Node} node @arg {string} attrName */
  function nodeHasAttribute(node, attrName) {
    return node.attrs && node.attrs[attrName]
  }

  function createUuid() {
    return window.crypto.randomUUID()
  }
}

/** @arg {Schema} schema */
export function extractNodeViews(schema) {
  return Object.fromEntries(
    Object.entries(schema.nodes).map(([name, node]) =>
      // @ts-expect-error ts error is because the type definition uses { [name: string]: ... }
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
 * @returns {NodeSpec}
 */
function paragraph() {
  return schema.node('p', { content: 'text*' })
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
    /** @arg {Node} node */
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

/** @arg {Array<string>} nodeTypes */
function content(...nodeTypes) {
  return `(${nodeTypes.flat().join(' | ')})+`
}

/**
 * @param {string} name
 * @param {(props: { id: string, $selected: Signal<boolean> }) => Tag<any>} Component
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
    /** @arg {Node} node */
    toDOM(node) { return /** @type const */ ([`custom-${name}`, { id: node.attrs.id }]) },
    parseDOM: [{
      tag: `custom-${name}`,
      /** @arg {HTMLElement} dom */
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

function link() {
  return {
    inclusive: false,

    attrs: { href: { validate: 'string' } },
    /** @arg {Mark} node @arg {boolean} inline */
    toDOM(node, inline) { return /** @type const */ (['a', { href: node.attrs.href }, 0]) },
    parseDOM: [{
      tag: 'a[href]',
      /** @arg {HTMLElement} dom */
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
/** @arg {NodeType} nodeType */
function unwrapFromList(nodeType) {
  /** @type {Command} */
  return (state, dispatch, view) => {
    const {$from, $to} = state.selection
    const range = $from.blockRange($to, node => node.type === nodeType)
    if (!range) return false

    return lift(state, dispatch, view)
  }
}

// TODO: move to generic utils / machinery
/** @arg {NodeType} nodeType */
export function inject(nodeType) {
  /** @type {Command} */
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

/**
 * @arg {EditorState} state
 * @arg {MarkType} mark
 */
export function isMarkActive(state, mark) {
  const { from, $from, to, empty } = state.selection
  return empty
    ? Boolean(mark.isInSet(state.storedMarks || $from.marks()))
    : state.doc.rangeHasMark(from, to, mark)
}

/**
 * @param {EditorState} state
 * @param {NodeType} nodeType
 */
export function isListActive(state, nodeType) {
  const { $from, $to } = state.selection
  return Boolean($from.blockRange($to, node => node.type === nodeType))
}

/**
 * @param {EditorState} state
 * @param {NodeType} nodeType
 * @param {{ [name: string]: any }} [attrs]
 */
export function isNodeActive(state, nodeType, attrs) {
  const { $from, $to } = state.selection
  return Boolean($from.parent.hasMarkup(nodeType, attrs))
}

const activeBackground = css`
  &.active {
    background-color: gainsboro;
  }
`
const enabledText = css`
  color: grey;
  &.enabled {
    color: unset;
  }
`
/**
 * @typedef {{
 *   config: EditorConfigBase<any>,
 *   $enabled: Signal<boolean>,
 *   $active: Signal<boolean>,
 *   onClick: () => void
 * }} BaseProps
 */


MarkStrong.style = css`
  font-weight: bold;
`
/** @arg {BaseProps} props */
function MarkStrong({ config, $enabled, $active, onClick }) {
  return Mark({ label: 'B', css: MarkStrong.style, config, $enabled, $active, onClick })
}

MarkEm.style = css`
  font-style: italic;
`
/** @arg {BaseProps} props */
function MarkEm({ config, $enabled, $active, onClick }) {
  return Mark({ label: 'I', css: MarkEm.style, config, $enabled, $active, onClick })
}

Mark.style = css`
  width: 2em;
  height: 2em;
`
/** @arg {{ label: string, css: string } & BaseProps} props */
function Mark({ label, css, config, $enabled, $active, onClick }) {
  return Button({
    css: [Mark.style, activeBackground, css],
    className: cx('Mark', asString($active, 'active')),
    onClick,
    label,
    disabled: $enabled.derive(x => !x),
    title: config.title,
  })
}

/** @arg {BaseProps} props */
function OrderedList({ config, $enabled, $active, onClick }) {
  return IconButton({ button: ButtonListOl, config, $enabled, $active, onClick })
}

/** @arg {BaseProps} props */
function UnorderedList({ config, $enabled, $active, onClick }) {
  return IconButton({ button: ButtonListUl, config, $enabled, $active, onClick })
}

/** @arg {BaseProps} props */
function Indent({ config, $enabled, $active, onClick }) {
  return IconButton({ button: ButtonIndent, config, $enabled, $active, onClick })
}

/** @arg {BaseProps} props */
function Outdent({ config, $enabled, $active, onClick }) {
  return IconButton({ button: ButtonOutdent, config, $enabled, $active, onClick })
}

IconButton.style = css`
  --width: 2em;
  --height: 2em;
`
/** @arg {{ button: (props: Attributes<"button">) => Tag<"button"> } & BaseProps} props */
function IconButton({ button, config, $enabled, $active, onClick }) {
  return button({
    css: [IconButton.style, activeBackground],
    className: cx('IconButton', asString($active, 'active')),
    onClick,
    disabled: $enabled.derive(x => !x),
    title: config.title,
  })
}

Select.style = css`
  border-radius: 0;
  height: 32px;
  padding: 0 5px;
  align-items: center;

  &,
  &::picker(select) {
    appearance: base-select;
  }
`
/**
 * @arg {{
 *   config: EditorConfigGroup<any>,
 *   canRenderItem: (item: EditorConfig<any>) => boolean,
 *   renderItem: (item: EditorConfig<any>) => any,
 * }} props
 */
function Select({ config, canRenderItem, renderItem }) {
  return select({ className: 'Select', css: Select.style },
    button(selectedcontent()),
    config.items.filter(canRenderItem).map(item =>
      renderItem({
        ...item,
        /** @arg {Omit<BaseProps, 'config'>} props */
        Component({ $enabled, $active, onClick }) {
          return option({ selected: $active }, item.Component({ config: item, $enabled, $active, onClick }))
        }
      })
    )
  )
}

/** @arg {BaseProps} props */
function Normal({ config, $enabled, $active, onClick }) {
  return span(
    {
      className: cx('Normal', asString($active, 'active'), asString($enabled, 'enabled')),
      css: [activeBackground, enabledText],
      onClick,
      title: config.title,
    },
    'Normal'
  )
}

/**
 * @template {string} T
 * @param {Signal<boolean>} $signal
 * @param {T} string
 * @return {Signal<false | T>}
 */
function asString($signal, string) {
  return $signal?.derive(value => value && string)
}

/** @arg {1 | 2 | 3 | 4} level */
function createHeadingComponent(level) {
  /** @arg {BaseProps} props */
  function Heading({ config, $enabled, $active, onClick }) {
    return tags[`h${level}`](
      {
        css: [activeBackground, enabledText],
        className: cx('Heading', asString($active, 'active'), asString($enabled, 'enabled')),
        onClick,
        title: config.title,
      },
      `Heading ${level}`
    )
  }
  return Heading
}
