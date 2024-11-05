import { context } from '#cms/client/context.js'
import { renderOnValue } from '#cms/client/machinery/renderOnValue.js'
import { useEventSourceAsSignal } from '#cms/client/machinery/useEventSourceAsSignal.js'
import { css, tags } from '#ui/tags.js'
import { RichTextEditor } from '../richTextEditor/RichTextEditor.js'

const { div } = tags

RichTextField.style = css`& {
}`
export function RichTextField({ document, field, $path, id }) {
  const { schema } = field
  const $richTextPathname = $path.derive(path => getRichTextPathname({ document, fieldPath: path }))

  const $events = useEventSourceAsSignal({
    pathnameSignal: $richTextPathname,
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
    div(
      RichTextField.style,
      RichTextEditor({ id, initialValue, $steps, synchronize, schema }),
    )
  )

  function synchronize({ clientId, steps, version, value }) {
    const controller = new AbortController()
    const result = fetch(
      `${context.apiPath}/${$richTextPathname.get()}`,
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

function getRichTextPathname({ document, fieldPath }) {
  // instead of using path as an id for prosemirror document handing, we should probably use a unique id for each document, that would prevent problems handling stuff nested in arrays
  return `documents/${document.schema.type}/${document.id}/rich-text/${encodeURIComponent(fieldPath)}`
}