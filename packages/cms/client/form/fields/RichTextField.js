import { context } from '#cms/client/context.js'
import { renderOnValue } from '#cms/client/machinery/renderOnValue.js'
import { useEventSourceAsSignal } from '#cms/client/machinery/useEventSourceAsSignal.js'
import { useSplitSignal } from '#ui/hooks.js'
import { RichTextEditor } from '../richTextEditor/RichTextEditor.js'

export function RichTextField({ document, field, $path, id }) {
  const { schema } = field
  const $richTextArgs = $path.derive(path => getRichTextArgs({ document, fieldPath: path }))

  const $events = useEventSourceAsSignal({
    channel: 'document/rich-text',
    argsSignal: $richTextArgs,
    events: ['initialValue', 'steps'],
  })

  const [$initialValueEvents, $stepsEvents] = useSplitSignal(
    $events,
    value => value?.event === 'initialValue',
  )

  const $initialValue = $initialValueEvents.derive(value =>
    value && { value: RichTextEditor.fromJson(schema, value.data.value), version: value.data.version }
  )
  const $steps = $stepsEvents.derive(value =>
    value ? parseStepsData(value, schema) : { steps: [], clientIds: [] }
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
          userId: context.userId,
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
