import { context } from '#cms/client/context.js'
import { renderOnValue } from '#cms/client/machinery/renderOnValue.js'
import { useEventSourceAsSignal } from '#cms/client/machinery/useEventSourceAsSignal.js'
import { useCombined } from '#ui/hooks.js'
import { RichTextEditor } from '../richTextEditor/RichTextEditor.js'
import { useConditionalDerive, useFieldValue } from './useFieldValue.js'
import { DOMSerializer, Schema as ProsemirrorSchema } from 'prosemirror-model'
import { Plugin as ProsemirrorPlugin, EditorState, NodeSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { css, tags } from '#ui/tags.js'
import { Signal } from '#ui/signal.js'
/** @import { EditorConfig, EditorConfigMark, EditorConfigNode } from '../richTextEditor/richTextConfig.js' */

const { div, span } = tags

/**
 * @template {ProsemirrorSchema} T
 * @typedef {{
 *   schema: T,
 *   createPlugins(): {
 *     $editorViewState: Signal<{ view: EditorView, state: EditorState }>,
 *     plugins: Array<ProsemirrorPlugin>,
 *   },
 *   configs: Array<EditorConfig<T>>,
 * }} RichTextFieldConfig
 */

/** @param {{ document, field: RichTextFieldConfig<any>, $path, id }} props */
export function RichTextField({ document, field, $path, id }) {
  const { schema, createPlugins, configs } = field
  const $richTextArgs = $path.derive(path => getRichTextArgs({ document, fieldPath: path }))

  const [$value, setValue] = useFieldValue({
    document, field, $path, initialValue: null,
    serializeValue: RichTextEditor.toJson,
    extractValueForDiff,
  })

  const $events = useEventSourceAsSignal({
    channel: 'document/rich-text',
    argsSignal: $richTextArgs,
    events: ['steps'],
    info: { version: $value.get()?.attrs?.version || 0 },
  })

  const $steps = $events.derive(value =>
    value && parseStepsData(value, schema)
  )

  const $initialValue = useInitialValue($value, $steps)

  const { plugins, $editorViewState } = createPlugins()

  // This might be an interesting performance optimization if that is needed:
  // https://discuss.prosemirror.net/t/current-state-of-the-art-on-syncing-data-to-backend/5175/4
  return renderOnValue($initialValue, initialValue =>
    div({ className: 'RichTextField' },
      MenuBar({ $editorViewState, configs }),
      RichTextEditor({
        id,
        initialValue: RichTextEditor.fromJson(schema, initialValue),
        $steps,
        synchronize,
        schema,
        plugins,
        onChange: handleChange
      }),
    )
  )

  function handleChange(doc) {
    setValue(doc)
  }

  function extractValueForDiff(value) {
    const serializer = DOMSerializer.fromSchema(schema)
    const content = serializer.serializeFragment(value.content)
    const div = window.document.createElement('div')
    div.appendChild(content)
    const serialized = div.innerHTML

    return serialized
  }

  function synchronize({ clientId, steps, version }) {
    const controller = new AbortController()
    const [type, id, encodedFieldPath] = $richTextArgs.get()

    const result = fetch(
      context.api.documents.single.richText({ type, id }),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          clientId,
          userId: context.userId,
          steps: steps.map(RichTextEditor.stepToJson),
          valueVersion: version,
          fieldType: field.type,
          encodedFieldPath,
        })
      }
    ).then(x => x.json())

    return {
      result,
      abort(reason) {
        controller.abort(reason)
      }
    }
  }
}

function parseStepsData(value, schema) {
  return {
    steps: value.data.steps.map(step => RichTextEditor.stepFromJson(schema, step)),
    clientIds: value.data.clientIds,
    version: value.data.version,
  }
}

function getRichTextArgs({ document, fieldPath }) {
  // instead of using path as an id for prosemirror document handing, we should probably use a unique id for each document, that would prevent problems handling stuff nested in arrays
  return [document.schema.type, document.id, encodeURIComponent(fieldPath)]
}

function useInitialValue($fieldValue, $steps) {

  // This signal only has a value once both versions align
  const $allignedDocumentAndSteps = useCombined($fieldValue, $steps)
    .derive(([value, steps]) => {
      return (value?.attrs?.version || 0) === steps?.version && (value || { type: 'doc' })
    })

  // This signal will return the first aligned value and then keep it at that first value
  const $stableAlignedDocumentAndSteps = useConditionalDerive(
    $allignedDocumentAndSteps,
    function shouldUpdate(newValue, oldValue) {
      return !oldValue && newValue
    }
  )

  return $stableAlignedDocumentAndSteps
}

MenuBar.style = css`
  display: flex;
  gap: var(--default-gap);
`
/**
 * @template {ProsemirrorSchema} T
 * @param {{
 *   $editorViewState: Signal<{ view: EditorView, state: EditorState }>,
 *   configs: Array<EditorConfig<T>>
 * }} props
 */
function MenuBar({ $editorViewState, configs }) {
  return div({ className: 'MenuBar', css: MenuBar.style },
    configs
      .filter(config => config.Component)
      .map(config => {
        switch (config.type) {
          case 'mark':
            return Mark({ $editorViewState, config })
          case 'node':
            return Node({ $editorViewState, config })
          default:
            throw new Error(`Do not know how to render a menu item with type '${config.type}'`)
        }
      })
  )
}

/**
 * @template {ProsemirrorSchema} T
 * @param {{ $editorViewState: Signal<{ view: EditorView, state: EditorState }>, config: EditorConfigMark<T> }} props
 */
function Mark({ $editorViewState, config }) {
  const $active = $editorViewState.derive(({ state }) => isMarkActive(state, config))
  const $enabled = $editorViewState.derive(({ state }) => config.command(state))
  return span({ className: 'Mark' },
    config.Component({
      config,
      $active,
      $enabled,
      onClick() {
        const { state, view } = $editorViewState.get()
        config.command(state, view.dispatch, view)
        view.focus()
      }
    })
  )
}

function Node({ $editorViewState, config }) {
  const $active = $editorViewState.derive(({ state }) => isNodeActive(state, config))
  const $enabled = $editorViewState.derive(({ state }) => config.command(state))
  return span({ className: 'Node' },
    config.Component({
      config,
      $active,
      $enabled,
      onClick() {
        const { state, view } = $editorViewState.get()
        config.command(state, view.dispatch, view)
        view.focus()
      }
    })
  )
}

/**
 * @template {ProsemirrorSchema} T
 * @param {EditorState} state
 * @param {EditorConfigMark<T>} config
 */
function isMarkActive(state, config) {
  if (!state)
    return false

  const { from, $from, to, empty } = state.selection
  return empty
    ? Boolean(config.mark.isInSet(state.storedMarks || $from.marks()))
    : state.doc.rangeHasMark(from, to, config.mark)
}

/**
 * @template {ProsemirrorSchema} T
 * @param {EditorState} state
 * @param {EditorConfigNode<T>} config
 */
function isNodeActive(state, config) {
  if (!state)
    return false

  const { $from, $to } = state.selection
  return Boolean($from.blockRange($to, node => node.type === config.node))
}
