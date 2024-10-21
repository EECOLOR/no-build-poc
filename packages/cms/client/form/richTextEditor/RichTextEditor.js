import { EditorView } from 'prosemirror-view'
import { Node, Schema } from 'prosemirror-model'
import { EditorState } from 'prosemirror-state'
import { undo, redo, history } from 'prosemirror-history'
import { Step } from 'prosemirror-transform'
import { keymap } from 'prosemirror-keymap'
import { baseKeymap, toggleMark, chainCommands, lift } from 'prosemirror-commands'
import { wrapInList, liftListItem, sinkListItem, splitListItem } from 'prosemirror-schema-list'
import * as collab from 'prosemirror-collab'

import { css, raw, tags } from '#ui/tags.js'
import { Signal } from '#ui/signal.js'
import { useOnDestroy } from '#ui/dynamic.js'
import { context } from '../../context.js'
import { nodeView, schemaPlugins } from './schema.js'

const { div } = tags

/**
 * @typedef {(data: { clientId, steps: readonly Step[], version: number, value: Node }) => {
 *   result: Promise<{ success: boolean }>,
 *   abort(reason?: string): void,
 * }} Synchronize
 */

RichTextEditor.style = css`
  .ProseMirror {
    padding: 0.2rem;
    border: inset 1px lightgray;
    min-height: 10rem;

    & ol, ul, li {
      margin: revert;
      padding: revert;
    }
  }
  .ProseMirror-hideselection *::selection {
    background-color: transparent;
  }
`

/**
 * @param {{
 *  initialValue: { value: Node, version: number },
 *  $steps: Signal<{ steps: Step[], clientIds: Array<number | string> }>,
 *  synchronize: Synchronize,
 *  schema: Schema,
 * }} props
 */
export function RichTextEditor({ id, initialValue, $steps, synchronize, schema }) {
  // TODO: show the cursors of other people with an overlay using https://prosemirror.net/docs/ref/#view.EditorView.coordsAtPos

  const { tryToSynchronize } = useSynchronization({ synchronize })

  const plugins = [
    history(),
    ...createKeymaps({ schema }),
    collab.collab({ version: initialValue.version, clientID: context.clientId }),
    ...schemaPlugins(schema),
  ]
  const view = new EditorView(null, {
    attributes: { id },
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
    nodeViews: Object.fromEntries(
      Object.entries(schema.nodes).map(([name, node]) =>
        [name, node.spec[nodeView]]
      )
    )
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

  return (
    div(
      RichTextEditor.style,
      raw(view.dom),
    )
  )
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
        synchronizationRequest.abort('Aborting: new steps available')
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
/**
 * @param {Schema} schema
 * @returns {Node}
 */
RichTextEditor.fromJson = function fromJson(schema, json) {
  if (!json) return json

  const checkedContent = json.content.map(x =>
    x.type in schema.nodes ? x : { type: 'unknown', attrs: { node: x } }
  )
  return Node.fromJSON(schema, { ...json, content: checkedContent })
}
/** @param {Step} step */
RichTextEditor.stepToJson = function stepToJson(step) {
  return step.toJSON()
}
/** @returns {Step} */
RichTextEditor.stepFromJson = function stepFromJson(schema, json) {
  if (!json) return json
  return Step.fromJSON(schema, json)
}

/** @param {{ schema: ReturnType<typeof createSchema> }} props */
function createKeymaps({ schema }) {
  return [
    keymap({
      'Mod-z': undo,
      'Shift-Mod-z': redo,
    }),
    keymap({ // TODO: extract these from the schema
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
