import { EditorView } from 'prosemirror-view'
import { Node, Schema } from 'prosemirror-model'
import { EditorState } from 'prosemirror-state'
import { undo, redo, history } from 'prosemirror-history'
import { Step } from 'prosemirror-transform'
import { keymap } from 'prosemirror-keymap'
import { baseKeymap, toggleMark, chainCommands, lift } from 'prosemirror-commands'
import { wrapInList, liftListItem, sinkListItem, splitListItem } from 'prosemirror-schema-list'
import * as collab from 'prosemirror-collab'

import { raw, tags } from '#ui/tags.js'
import { Signal } from '#ui/signal.js'
import { useOnDestroy } from '#ui/dynamic.js'
import { render } from '#ui/render/clientRenderer.js'
import { context } from '../../context.js'

const { div } = tags

const schema = createSchema()

/**
 * @typedef {(data: { clientId, steps: readonly Step[], version: number, value: Node }) => {
 *   result: Promise<{ success: boolean }>,
 *   abort(reason?: string): void,
 * }} Synchronize
 */

/**
 * @param {{
 *  initialValue: { value: Node, version: number },
 *  $steps: Signal<{ steps: Step[], clientIds: Array<number | string> }>,
 *  synchronize: Synchronize,
 * }} props
 */
export function RichTextEditor({ initialValue, $steps, synchronize }) {
  // TODO: show the cursors of other people with an overlay using https://prosemirror.net/docs/ref/#view.EditorView.coordsAtPos

  const { tryToSynchronize } = useSynchronization({ synchronize })

  const plugins = [
    history(),
    ...createKeymaps({ schema }),
    collab.collab({ version: initialValue.version, clientID: context.clientId }),
  ]
  const view = new EditorView(null, {
    state: EditorState.create({ doc: initialValue.value, schema, plugins, }),
    dispatchTransaction(transaction) {
      const newState = view.state.apply(transaction)
      view.updateState(newState)
      // you can probably use this bit of code for version history
      // if (transaction.docChanged)
      //   onChange({
      //     steps: transaction.steps.map(x => ({
      //       step: x.toJSON(),
      //       invert: x.invert(docBeforeChange).toJSON()
      //     }))
      //   })
      tryToSynchronize(view)
    },
    attributes: {
      style: `padding: 0.2rem; border: inset 1px lightgray;`,
    },
  })
  const unsubscribe = $steps.subscribe(({ steps, clientIds }) => {
    view.dispatch(
      collab.receiveTransaction(view.state, steps, clientIds, { mapSelectionBackward: true })
    )
  })

  useOnDestroy(() => {
    unsubscribe()
    view.destroy()
  })

  return raw(view.dom)
}

// TODO: synchronize is probbaly a bad name
/**
 * @param {{
 *   synchronize: Synchronize
 * }} props
 */
function useSynchronization({ synchronize }) {
  let synchronizationRequest = null

  useOnDestroy(() => { if (synchronizationRequest) synchronizationRequest.abort() })

  return { tryToSynchronize }

  /** @param {EditorView} view */
  async function tryToSynchronize(view, retries = 5) {
    try {
      const sendable = collab.sendableSteps(view.state)
      if (!sendable) return

      if (synchronizationRequest) {
        synchronizationRequest.abort('New steps available')
        synchronizationRequest = null
      }

      const { clientID, steps, version } = sendable
      const { result, abort } = synchronize({ clientId: clientID, steps, version, value: view.state.doc })
      let aborted = false
      synchronizationRequest = {
        abort(reason) {
          synchronizationRequest = null
          abort(reason)
          aborted = true
        }
      }

      const { success } = await result
      synchronizationRequest = null
      if (aborted) return
      if (success) return // no need to do anything else, steps will come in via the other channel

      if (!retries)
        throw new Error(`Failed to synchronize and no more retries left`)

      console.log('Retrying synchronization')

      tryToSynchronize(view, retries - 1)
    } catch (e) {
      console.error(e)
    }
  }
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
  return Node.fromJSON(schema, json)
}
/** @param {Step} step */
RichTextEditor.stepToJson = function stepToJson(step) {
  return step.toJSON()
}
/** @returns {Step} */
RichTextEditor.stepFromJson = function stepFromJson(json) {
  if (!json) return json
  return Step.fromJSON(schema, json)
}

function createSchema() {
  const content = '(paragraph | orderedList | unorderedList)+'
  const docContent = `(paragraph | orderedList | unorderedList | heading | custom)+`
  return new Schema({
    nodes: {
      doc: {
        content: docContent,
      },
      paragraph: {
        content: 'text*',
        parseDOM: [{ tag: 'p' }],
        toDOM() { return ['p', 0] },
      },
      heading: {
        attrs: { level: { default: 1, validate: 'number' } },
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
      orderedList: {
        attrs: { order: { default: 1, validate: 'number' }},
        content: 'listItem+',
        parseDOM: [{
          tag: 'ol',
          getAttrs(dom) {
            return {order: dom.hasAttribute('start') ? parseInt(dom.getAttribute('start'), 10) : 1}
          }
        }],
        toDOM(node) {
          return node.attrs.order === 1 ? ['ol', 0] : ['ol', { start: node.attrs.order }, 0]
        }
      },
      unorderedList: {
        parseDOM: [{ tag: 'ul' }],
        content: 'listItem+',
        toDOM() { return ['ul', 0] }
      },
      listItem: {
        content,
        parseDOM: [{ tag: 'li' }],
        toDOM() { return ['li', 0] }
      },
      text: {},

      custom: {
        // atom: true, // use this when you do not have a 'hole' (contentDOM)
        content: 'text*', // use this when you have a 'hole' (contentDOM)

        inline: false,
        // TODO: parseDOM (only needed for a parser (and maybe also copy-paste))
        toDOM() {
          const contentDOM = document.createElement('p')

          // TODO: should we call destroy here?
          const { result, destroy } = render(
            div({ style: { display: 'flex' }},
              Item({ title: 'ONE',  backgroundColor: 'red' }),
              Item({ title: 'TWO',  backgroundColor: 'blue' }),
              Item({ title: raw(contentDOM),  backgroundColor: 'green' }),
            )
          )
          // For atom like components (that can not be directly edited) simply return the result of render
          // This is the more complex version where the content can be edited
          return {
            dom: result,
            contentDOM
          }

          function Item({ title, backgroundColor }) {
            return div({ style: { color: 'white', padding: '0.2rem', backgroundColor } }, title)
          }
        }
      }
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
function createKeymaps({ schema }) {
  return [
    keymap({
      'Mod-z': undo,
      'Shift-Mod-z': redo,
      'Mod-b': toggleMark(schema.marks.strong),
      'Mod-i': toggleMark(schema.marks.em),
      'Shift-Mod-7': chainCommands(
        unwrapFromList(schema.nodes.orderedList),
        wrapInList(schema.nodes.orderedList)
      ),
      'Shift-Mod-8': chainCommands(
        unwrapFromList(schema.nodes.unorderedList),
        wrapInList(schema.nodes.unorderedList),
      ),
      'Tab': sinkListItem(schema.nodes.listItem),
      'Shift-Tab': liftListItem(schema.nodes.listItem),
      'Enter': splitListItem(schema.nodes.listItem),

      'Shift-Mod-5': inject(schema.nodes.custom),
    }),
    keymap(baseKeymap),
  ]
}

function unwrapFromList(nodeType) {
  return (state, dispatch, view) => {
    const {$from, $to} = state.selection
    const range = $from.blockRange($to, node => node.type === nodeType)
    if (!range) return false

    return lift(state, dispatch, view)
  }
}

function inject(nodeType) {
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
