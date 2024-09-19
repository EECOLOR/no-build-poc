import { EditorView } from 'prosemirror-view'
import { Node, Schema } from 'prosemirror-model'
import { EditorState } from 'prosemirror-state'
import { undo, redo, history } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import { baseKeymap } from 'prosemirror-commands'
import { toggleMark } from 'prosemirror-commands'

import { raw } from '#ui/tags.js'
import { Signal } from '#ui/signal.js'
import { useOnDestroy } from '#ui/dynamic.js'

const schema = createSchema()

/** @param {{ $value: Signal<Node | undefined>, onChange(node: Node): void }} props */
export function RichTextEditor({ $value, onChange }) {
  const plugins = [
    history(),
    createKeymap({ schema }),
  ]
  const view = new EditorView(null, {
    state: EditorState.create({ doc: $value.get(), schema, plugins, }),
    dispatchTransaction(transaction) {
      const newState = view.state.apply(transaction)
      view.updateState(newState)
      if (transaction.docChanged) onChange(newState.doc)
    },
    attributes: {
      style: `border: inset 1px light-dark(rgb(118, 118, 118), rgb(133, 133, 133))`,
    },
  })
  const unsubscribe = $value.subscribe(doc => {
    if (view.state.doc.eq(doc))
      return

    const state = EditorState.create({ doc, schema, plugins })
    view.updateState(state)
  })
  useOnDestroy(() => {
    unsubscribe()
    view.destroy()
  })

  return raw(view.dom)
}
/** @param {Node} a @param {Node} b */
RichTextEditor.isEqual = function isEqual(a, b) {
  if (!a) return false
  return a.eq(b)
}
/** @param {Node} doc */
RichTextEditor.toJson = function toJson(doc) {
  return doc.toJSON()
}
/** @returns {Node} */
RichTextEditor.fromJson = function fromJson(json) {
  if (!json) return json
  console.log(json)
  return Node.fromJSON(schema, json)
}

function createSchema() {
  return new Schema({
    nodes: {
      doc: { content: '(paragraph | heading)+'},
      paragraph: {
        content: 'text*',
        parseDOM: [{ tag: 'p' }],
        toDOM() { return ['p', 0] },
      },
      heading: {
        attrs: { level: { default: 1, validate: "number" } },
        content: 'text*',
        defining: true,
        parseDOM: [
          { tag: 'h1', attrs: { level: 1 } },
          { tag: 'h2', attrs: { level: 2 } },
          { tag: 'h3', attrs: { level: 3 } },
          { tag: 'h4', attrs: { level: 4 } },
          { tag: 'h5', attrs: { level: 5 } },
          { tag: 'h6', attrs: { level: 6 } }
        ],
        toDOM(node) { return [`h${node.attrs.level}`, 0] }
      },
      text: {},
    },
    marks: {
      link: {
        attrs: { href: { validate: 'string' } },
        inclusive: false,
        parseDOM: [{
          tag: 'a[href]',
          getAttrs(dom) { return { href: dom.getAttribute('href') } },
        }],
        toDOM(node) { return ['a', { href: node.attrs.href }, 0] },
      },
      em: {
        parseDOM: [ { tag: 'i' }, { tag: 'em' }],
        toDOM() { return ['em', 0] },
      },
      strong: {
        parseDOM: [ { tag: 'strong' }, { tag: 'b' } ],
        toDOM() { return ['strong', 0] }
      },
    }
  })
}

/** @param {{ schema: ReturnType<typeof createSchema> }} props */
function createKeymap({ schema }) {
  return keymap({
    ...baseKeymap,
    'Mod-z': undo,
    'Shift-Mod-z': redo,
    'Mod-b': toggleMark(schema.marks.strong),
    'Mod-i': toggleMark(schema.marks.em),
  })
}
