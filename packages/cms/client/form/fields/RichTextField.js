import { context } from '#cms/client/context.js'
import { renderOnValue } from '#cms/client/machinery/renderOnValue.js'
import { useEventSourceAsSignal } from '#cms/client/machinery/useEventSourceAsSignal.js'
import { useCombined } from '#ui/hooks.js'
import { RichTextEditor } from '../richTextEditor/RichTextEditor.js'
import { useConditionalDerive, useFieldValue } from './useFieldValue.js'
import { DOMSerializer, Schema as ProsemirrorSchema } from 'prosemirror-model'

/**
 * @typedef {{
 *   schema: ProsemirrorSchema,
 * }} RichTextFieldConfig
 */

export function RichTextField({ document, field, $path, id }) {
  const { schema, plugins } = field
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

  // This might be an interesting performance optimization if that is needed:
  // https://discuss.prosemirror.net/t/current-state-of-the-art-on-syncing-data-to-backend/5175/4
  return renderOnValue($initialValue, initialValue =>
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
