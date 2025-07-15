import { createSignal, Signal } from '#ui/signal.js'
import { keymap } from 'prosemirror-keymap'
import { Plugin } from 'prosemirror-state'
/** @import { Schema, MarkType } from 'prosemirror-model' */
/** @import { Command } from 'prosemirror-state' */

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
 *   Component?: (props: {
 *     config:EditorConfig<T>,
 *     $active: Signal<boolean>,
 *     $enabled: Signal<boolean>,
 *     onClick: () => void
 *   }) => any,
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

  return {
    schema,
    configs,
    createPlugins() {
      const shortcutPlugin = createShortcutPlugin(configs)
      const { $editorViewState, editorViewStatePlugin } = createEditorViewStatePlugin()

      return {
        $editorViewState,
        plugins: [
          shortcutPlugin,
          editorViewStatePlugin,
        ],
      }
    }
  }
}

/**
   * @template {Schema} T
   * @param {Array<EditorConfig<T>>} configs
   */
function createShortcutPlugin(configs) {
  return keymap(
    Object.fromEntries(
      configs
        .filter(config => config.shortcut)
        .map(config => [config.shortcut, config.command])
    )
  )
}

function createEditorViewStatePlugin() {
  const [$editorViewState, setEditorViewState] = createSignal({ view: null, state: null })

  return {
    $editorViewState,
    editorViewStatePlugin:
      new Plugin({
      view(editorView) {
        setEditorViewState({ view: editorView, state: editorView.state })

        return {
          update(editorView, prevEditorState) {
            setEditorViewState({ view: editorView, state: editorView.state })
          },
          destroy() {
            setEditorViewState({ view: null, state: null })
          }
        }
      }
    })
  }
}
