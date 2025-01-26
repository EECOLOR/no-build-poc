import { context } from '#cms/client/context.js'
import { renderOnValue } from '#cms/client/machinery/renderOnValue.js'
import { useEventSourceAsSignal } from '#cms/client/machinery/useEventSourceAsSignal.js'
import { RichTextEditor } from '../richTextEditor/RichTextEditor.js'

export function RichTextField({ document, field, $path, id }) {
  const { schema } = field
  const $richTextArgs = $path.derive(path => getRichTextArgs({ document, fieldPath: path }))

  const $events = useEventSourceAsSignal({
    channel: 'document/rich-text',
    argsSignal: $richTextArgs,
    events: ['initialValue', 'steps'],
  })

  const $initialValue = $events.derive((value, previous) =>
    value?.event === 'initialValue'
      ? { value: RichTextEditor.fromJson(schema, value.data.value), version: value.data.version }
      : previous
  )
  const $steps = $events.derive((value, previous) =>
    value?.event === 'steps' ? parseStepsData(value, schema) :
    previous ? previous :
    { steps: [], clientIds: [] }
  )

  // This might be an interesting performance optimization if that is needed:
  // https://discuss.prosemirror.net/t/current-state-of-the-art-on-syncing-data-to-backend/5175/4
  return renderOnValue($initialValue, initialValue =>
    RichTextEditor({ id, initialValue, $steps, synchronize, schema }),
  )

  function synchronize({ clientId, steps, version, value }) {
    const controller = new AbortController()
    const [type, id, encodedFieldPath] = $richTextArgs.get()

    const result = fetch(
      context.api.documents.single.richText({ type, id, encodedFieldPath }),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          clientId,
          steps: steps.map(RichTextEditor.stepToJson),
          documentVersion: document.$value.get().version,
          valueVersion: version,
          value: RichTextEditor.toJson(value),
          fieldType: field.type,
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
    clientIds: value.data.clientIds
  }
}

function getRichTextArgs({ document, fieldPath }) {
  // instead of using path as an id for prosemirror document handing, we should probably use a unique id for each document, that would prevent problems handling stuff nested in arrays
  return [document.schema.type, document.id, encodeURIComponent(fieldPath)]
}
