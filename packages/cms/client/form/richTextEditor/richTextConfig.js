import { createSignal, Signal } from '#ui/signal.js'
import { keymap } from 'prosemirror-keymap'
import { tags } from '#ui/tags.js'
import { Plugin } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
/** @import { Schema, MarkType } from 'prosemirror-model' */
/** @import { Command, EditorState } from 'prosemirror-state' */

const { div, button } = tags

/**
 * @template {Schema} T
 * @typedef {(schema: T) => Array<EditorConfig<T>>} EditorConfigConstructor
 */

/**
 * @template {Schema} T
 * @typedef {{
 *   title: string,
 *   mark?: MarkType,
 *   action?: Action<T>,
 *   command: Command,
 *   shortcut?: string,
 * }} EditorConfig
 */

// Actions as menu items can be implemented using a plugin
/**
 * @template {Schema} T
 * @typedef {{
 *   render(props: { title: string, onClick: () => void }): any
 * }} Action
 */

/**
 * @template {Schema} T
 * @param {{
 *   schema: T,
 *   editor: EditorConfigConstructor<T>,
 * }} config
 */
export function richTextConfig({ schema, editor }) {
  const configs = editor(schema)
  const shortcutPlugin = keymap(
    Object.fromEntries(
      configs
      .filter(config => config.shortcut)
      .map(config => [config.shortcut, config.command])
    )
  )

  const [$editorInfo, setEditorView] = createSignal({ view: null, state: null })

  return {
    schema,
    plugins: [
      shortcutPlugin,
      new Plugin({
        view(editorView) {
          setEditorView({ view: editorView, state: editorView.state })

          return {
            update(editorView, prevEditorState) {
              setEditorView({ view: editorView, state: editorView.state })
            },
            destroy() {
              setEditorView({ view: null, state: null })
            }
          }
        }
      })
    ],
    MenuItems,
  }

  function MenuItems() {
    const markConfigs = configs.filter(config => config.mark)

    return div(
      $editorInfo.derive(({ state }) =>
        state
          ? `${state.selection.from} - ${state.selection.to}`
          : 'no selection'
      ),
      div(
        markConfigs.map(config => Mark({ $editorInfo, config }))
      )
    )
  }
}

/**
 * @template {Schema} T
 * @param {{ $editorInfo: Signal<{ view: EditorView, state: EditorState }>, config: EditorConfig<T> }} props
 */
function Mark({ $editorInfo, config }) {
  const $markActive = $editorInfo.derive(({ state }) => {
    const { from, $from, to, empty } = state.selection
    return empty
      ? config.mark.isInSet(state.storedMarks || $from.marks())
      : state.doc.rangeHasMark(from, to, config.mark)
  })
  return button(
    {
      type: 'button',
      style: {
        border: $markActive.derive(active => active ? '2px solid blue' : 'none')
      },
      onClick: () => {
        const { state, view } = $editorInfo.get()
        config.command(state, view.dispatch, view)
        view.focus()
      },
    },
    config.title,
  )
}
