import { keymap } from 'prosemirror-keymap'
/** @import { Schema } from 'prosemirror-model' */
/** @import { Command } from 'prosemirror-state' */

/**
 * @template {Schema} T
 * @typedef {(schema: T) => Array<EditorConfig<T>>} EditorConfigConstructor
 */

/**
 * @template {Schema} T
 * @typedef {{
 *   title: string,
 *   actions?: Array<Action<T>>,
 *   shortcuts?: { [key: string]: Command },
 * }} EditorConfig
 */

// Actions as menu items can be implemented using a plugin
/**
 * @template {Schema} T
 * @typedef {{
 *   icon: HTMLElement,
 *   renderButton(props: { title: string, icon: HTMLElement, onClick(schema: T): Command }): HTMLElement
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
    plugins: configs
      .filter(config => config.shortcuts)
      .map(config => keymap(config.shortcuts))
  }
}
