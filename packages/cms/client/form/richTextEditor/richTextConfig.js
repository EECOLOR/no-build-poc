import { createSignal, Signal } from '#ui/signal.js'
import { keymap } from 'prosemirror-keymap'
import { Plugin } from 'prosemirror-state'
/** @import { Schema, MarkType, NodeType } from 'prosemirror-model' */
/** @import { Command, EditorState } from 'prosemirror-state' */

/**
 * @template {Schema} T
 * @typedef {(schema: T) => Array<EditorConfig<T>>} EditorConfigConstructor
 */

// TODO: move types to a .ts file
/**
 * @template {Schema} T
 * @typedef {EditorConfigMark<T> | EditorConfigNode<T> | EditorConfigGroup<T>} EditorConfig
 */

/**
 * @template {Schema} T
 * @typedef {{
 *   readonly title: string,
 *   readonly command: Command,
 *   readonly shortcut?: string,
 *   readonly isActive?: (state: EditorState) => boolean,
 *   readonly Component?: (props: {
 *     config:EditorConfig<T>,
 *     $active: Signal<boolean>,
 *     $enabled: Signal<boolean>,
 *     onClick: () => void
 *   }) => any,
 * }} EditorConfigBase
 */

/**
 * @template {Schema} T
 * @typedef {EditorConfigBase<T> & {
 *   readonly type: 'mark',
 *   readonly mark: MarkType,
 * }} EditorConfigMark
 */

/**
 * @template {Schema} T
 * @typedef {EditorConfigBase<T> & {
 *   readonly type: 'node',
 *   readonly node: NodeType,
 * }} EditorConfigNode
 */

/**
 * @template {Schema} T
 * @typedef {{
 *   readonly type: 'group',
 *   readonly title: string,
 *   readonly items: ReadonlyArray<Exclude<EditorConfig<T>, EditorConfigGroup<T>>>,
 *   readonly Component?: (props: {
 *     config: EditorConfig<T>,
 *     canRenderItem: (item: EditorConfig<T>) => boolean,
 *     renderItem: (item: EditorConfig<T>) => any,
 *   })
 * }} EditorConfigGroup
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
        .flatMap(config => config.type === 'group' ? config.items : [config])
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
