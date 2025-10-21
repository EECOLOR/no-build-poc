import { context } from '#cms/client/context.js'
import { renderOnValue } from '#cms/client/machinery/renderOnValue.js'
import { useEventSourceAsSignal } from '#cms/client/machinery/useEventSourceAsSignal.js'
import { useCombined } from '#ui/hooks.js'
import { RichTextEditor } from '../richTextEditor/RichTextEditor.js'
import { useConditionalDerive, useFieldValue } from './useFieldValue.js'
import { DOMSerializer, Node as ProsemirrorNode, Schema as ProsemirrorSchema } from 'prosemirror-model'
import { Plugin as ProsemirrorPlugin, EditorState, NodeSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { css, tags } from '#ui/tags.js'
import { Signal } from '#ui/signal.js'
import { asConst } from '#typescript/helpers.js'
/** @import { EditorConfig, EditorConfigGroup, EditorConfigMark, EditorConfigNode } from '../richTextEditor/richTextConfig.js' */
/** @import { DocumentContainer, DocumentPath, RichTextSteps } from '#cms/types.ts' */
/** @import { DocumentSchema } from '#cms/client/cmsConfigTypes.ts' */
/** @import { Synchronize } from '../richTextEditor/RichTextEditor.js' */
/** @import { Event } from '#cms/client/machinery/useEventSourceAsSignal.js' */

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

/**
 * @arg {{
 *   document: DocumentContainer,
 *   field: { name: string, type: DocumentSchema.FieldTypes } & RichTextFieldConfig<any>,
 *   $path: Signal<DocumentPath>,
 *   id: string,
 * }} props
 */
export function RichTextField({ document, field, $path, id }) {
  const { schema, createPlugins, configs } = field
  const $richTextArgs = $path.derive(path => getRichTextArgs({ document, fieldPath: path }))

  const [$value, setValue] = useFieldValue({
    document, field, $path, initialValue: /** @type {ProsemirrorNode} */ (null),
    serializeValue: RichTextEditor.toJson,
    extractValueForDiff,
  })

  const $events = useEventSourceAsSignal({
    channel: 'document/rich-text',
    argsSignal: $richTextArgs,
    events: ['steps'],
    initialValue: /** @type {null} */ (null),
    type: /** @type {RichTextSteps} */ (null),
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

  /** @arg {ProsemirrorNode} doc */
  function handleChange(doc) {
    setValue(doc)
  }

  /** @arg {ProsemirrorNode} value */
  function extractValueForDiff(value) {
    const serializer = DOMSerializer.fromSchema(schema)
    const content = serializer.serializeFragment(value.content)
    const div = window.document.createElement('div')
    div.appendChild(content)
    const serialized = div.innerHTML

    return serialized
  }

  /** @type {Synchronize} */
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

/** @arg {Event<RichTextSteps>} value @arg {ProsemirrorSchema} schema */
function parseStepsData(value, schema) {
  return {
    steps: value.data.steps.map(step => RichTextEditor.stepFromJson(schema, step)),
    clientIds: value.data.clientIds,
    version: value.data.version,
  }
}

/**
 * @arg {{
 *   document: DocumentContainer,
 *   fieldPath: DocumentPath,
 * }} props
 */
function getRichTextArgs({ document, fieldPath }) {
  // instead of using path as an id for prosemirror document handing, we should probably use a unique id for each document, that would prevent problems handling stuff nested in arrays
  return [document.schema.type, document.id, encodeURIComponent(fieldPath)]
}

/**
 * @arg {Signal<ProsemirrorNode>} $fieldValue
 * @arg {Signal<RichTextSteps>} $steps
 */
function useInitialValue($fieldValue, $steps) {

  // This signal only has a value once both versions align
  const $allignedDocumentAndSteps = useCombined($fieldValue, $steps)
    .derive(([value, steps]) => {
      return (value?.attrs?.version || 0) === steps?.version && (value || asConst({ type: 'doc' }))
    })

  // This signal will return the first aligned value and then keep it at that first value
  const $stableAlignedDocumentAndSteps = useConditionalDerive(
    $allignedDocumentAndSteps,
    /** @arg {any} newValue @arg {any} oldValue */
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
    configs.filter(canRenderItem).map(createRenderItem($editorViewState))
  )
}

/**
 * @template {ProsemirrorSchema} T
 * @param {{ $editorViewState: Signal<{ view: EditorView, state: EditorState }>, config: EditorConfigMark<T> }} props
 */
function Mark({ $editorViewState, config }) {
  const $active = $editorViewState.derive(({ state }) => Boolean(state && config.isActive(state)))
  const $enabled = $editorViewState.derive(({ state }) => Boolean(state && config.command(state)))
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

/**
 * @arg {{
 *   $editorViewState: Signal<{ view: EditorView, state: EditorState }>,
 *   config: EditorConfigNode<any>,
 * }} props
 */
function Node({ $editorViewState, config }) {
  const $active = $editorViewState.derive(({ state }) => Boolean(state && config.isActive?.(state)))
  const $enabled = $editorViewState.derive(({ state }) => Boolean(state && config.command(state)))
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
 * @arg {{
*   $editorViewState: Signal<{ view: EditorView, state: EditorState }>,
*   config: EditorConfigGroup<any>,
* }} props
*/
function Group({ $editorViewState, config }) {
  return div(
    config.Component({ config, canRenderItem, renderItem: createRenderItem($editorViewState) })
  )
}

/** @arg {EditorConfig<any>} item */
function canRenderItem(item) {
  return Boolean(item.Component)
}

/** @arg {Signal<{ view: EditorView, state: EditorState }>} $editorViewState */
function createRenderItem($editorViewState) {

  /** @arg {EditorConfig<any>} config */
  return function renderItem(config) {
    switch (config.type) {
      case 'mark':
        return Mark({ $editorViewState, config })
      case 'node':
        return Node({ $editorViewState, config })
      case 'group':
        return Group({ $editorViewState, config })
      default:
        // @ts-expect-error
        throw new Error(`Do not know how to render a menu item with type '${config.type}'`)
    }
  }
}
