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
 * @typedef {(data: { clientId, steps: readonly Step[], version: number }) => {
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
 *  id: string,
 *  initialValue: Node,
 *  $steps: Signal<{ steps: Step[], clientIds: Array<number | string>, version: number }>,
 *  synchronize: Synchronize,
 *  onChange(doc: Node): void,
 *  schema: Schema,
 * }} props
 */
export function RichTextEditor({ id, initialValue, $steps, synchronize, onChange, schema }) {
  // TODO: show the cursors of other people with an overlay using https://prosemirror.net/docs/ref/#view.EditorView.coordsAtPos

  const { tryToSynchronize } = useSynchronization({ synchronize })

  const plugins = [
    history(),
    ...createKeymaps({ schema }),
    collab.collab({ version: initialValue.attrs.version, clientID: context.clientId }),
    ...schemaPlugins(schema),
  ]
  const view = new EditorView(null, {
    attributes: { id },
    state: EditorState.create({ doc: initialValue, schema, plugins, }),
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
      const stepsWereSent = tryToSynchronize(view)
      if (transaction.docChanged && !stepsWereSent && newState.doc.attrs.lastEditClientId === context.clientId) {
        onChange(view.state.doc)
      }
    },
    nodeViews: Object.fromEntries(
      Object.entries(schema.nodes).map(([name, node]) =>
        [name, node.spec[nodeView]] // https://github.com/ProseMirror/prosemirror-model/commit/c8c7b62645d2a8293fa6b7f52aa2b04a97821f34#r148502417
      )                             // if link does not jump (https://github.com/orgs/community/discussions/139005#discussioncomment-11092579)
    )                               // src/schema.ts line 432
  })
  const unsubscribe = $steps.subscribe(({ steps, clientIds, version }) => { // TODO: rename version to sessionVersion
    const tr = collab.receiveTransaction(view.state, steps, clientIds, { mapSelectionBackward: true })
    tr.setDocAttribute('version', version)
    const [lastEditClientId] = clientIds.slice(-1)
    if (lastEditClientId) {
      tr.setDocAttribute('lastEditClientId', lastEditClientId)
    }
    view.dispatch(tr)
  })

  useOnDestroy(() => {
    unsubscribe()
    view.destroy()
  })

  return (
    div({ css: RichTextEditor.style },
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

  /**
   * @param {EditorView} view
   * @returns {Boolean} Indicating that steps were sent to the server
   */
  function tryToSynchronize(view, retries = 5) {
    try {
      const sendable = collab.sendableSteps(view.state)
      if (!sendable)
        return

      if (synchronizationRequest) {
        synchronizationRequest.abort('Aborting: new steps available')
        synchronizationRequest = null
      }

      const { clientID, steps, version } = sendable
      const { result, abort } = synchronize({ clientId: clientID, steps, version })
      let aborted = false
      synchronizationRequest = {
        abort(reason) {
          synchronizationRequest = null
          abort(reason)
          aborted = true
        }
      }

      result
        .then(({ success }) => {
          synchronizationRequest = null
          if (aborted)
            return

          if (success)
            return // no need to do anything else, steps will come in via the other channel

          if (!retries)
            throw new Error(`Failed to synchronize and no more retries left`)

          console.log('Retrying synchronization')

          tryToSynchronize(view, retries - 1)
        })
        .catch(e => {
          console.error(e)
        })

      return true // steps were sent (maybe not successful)
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

  const checkedContent = json.content?.map(x =>
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

// TODO: we don't know the schema here, so these need to be added to the schema and picked up from there
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
