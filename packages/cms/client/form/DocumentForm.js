import { createSignal } from '#ui/signal.js'
import { tags } from '#ui/tags.js'
import { context, getSchema } from '../context.js'
import { renderOnValue } from '../machinery/renderOnValue.js'
import { useEventSourceAsSignal } from '../machinery/useEventSourceAsSignal.js'
import { RichTextEditor } from './richTextEditor/RichTextEditor.js'

const { div, h1, h2, label, span, input, button } = tags

export function DocumentForm({ id, $document, schemaType }) {
  const document = { id, schema: getSchema(schemaType), $value: $document }

  return (
    div(// TODO: use context.documentView
      DocumentTitle({ document }),
      DocumentFields({ document }),
    )
  )
}

function DocumentTitle({ document }) {
  return h1(document.$value.derive(doc => document.schema.preview(doc).title))
}

function DocumentFields({ document }) {
  const path = ''
  return ObjectFields({ document, fields: document.schema.fields, path })
}

function ObjectFields({ document, fields, path }) {
  return (
    div(
      {
        style: {
          display: 'grid',
          gridTemplateColumns: 'max-content 1fr',
          gridColumnGap: '1em',
        }
      },
      fields.map(field => Field({ document, field, path: `${path}/${field.name}` }))
    )
  )
}

const fieldRenderers = /** @type {const} */({
  'string': StringField,
  'rich-text': RichTextField,
  default: ObjectField,
})

function Field({ document, field, path }) {
  let renderer = fieldRenderers[field.type]
  if (!renderer && 'fields' in field)
    renderer = fieldRenderers.default
  if (!renderer)
    return `Unknown field type '${field.type}'`

  return (
    label(
      {
        style: {
          gridColumn: 'span 2',

          display: 'grid',
          grid: 'inherit',
          gridTemplateColumns: 'subgrid',
          gridGap: 'inherit',
        }
      },
      span(field.title),
      renderer({ document, field, path })
    )
  )
}

function StringField({ document, field, path }) {
  const [$value, setValue] = useFieldValue({ document, path })

  return input({ type: 'text', value: $value, onInput: handleInput })

  function handleInput(e) {
    setValue(e.currentTarget.value)
  }
}

function RichTextField({ document, field, path }) {
  const richTextPathname = getRichTextPathname({ document, fieldPath: path })

  const $events = useEventSourceAsSignal({
    pathname: richTextPathname,
    events: ['initialValue', 'steps'],
  })
  const $initialValue = $events.derive((value, previous) =>
    value?.event === 'initialValue'
      ? { value: RichTextEditor.fromJson(value.data.value), version: value.data.version }
      : previous
  )
  const $steps = $events.derive((value, previous) =>
    value?.event === 'steps' ? { steps: value.data.steps.map(RichTextEditor.stepFromJson), clientIds: value.data.clientIds } :
    previous ? previous :
    { steps: [], clientIds: [] }
  )

  // This might be an interesting performance optimization if that is needed:
  // https://discuss.prosemirror.net/t/current-state-of-the-art-on-syncing-data-to-backend/5175/4
  return renderOnValue($initialValue,
    initialValue => RichTextEditor({ initialValue, $steps, synchronize }),
  )

  function synchronize({ clientId, steps, version, value }) {
    const controller = new AbortController()
    const result = fetch(
      richTextPathname,
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
          version,
          value: RichTextEditor.toJson(value),
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

function ObjectField({ document, field, path }) {
  const [$expanded, setExpanded] = createSignal(true)
  return (
    div(
      h2(field.title),
      button({ type: 'button', onClick: _ => setExpanded(x => !x) }, $expanded.derive(x => x ? '🡅' : '🡇')),
      renderOnValue($expanded,
        _ => ObjectFields({ document, fields: field.fields, path })
      )
    )
  )
}

function getRichTextPathname({ document, fieldPath }) {
  // instead of using path as an id for prosemirror document handing, we should probably use a unique id for each document, that would prevent problems handling stuff nested in arrays
  return `${context.apiPath}/documents/${document.schema.type}/${document.id}/rich-text?fieldPath=${fieldPath}`
}

function useFieldValue({ document, path }) {
  const $valueFromDocument = document.$value.derive(doc => get(doc, path) || '')
  let localValue = $valueFromDocument.get()
  let dirty = false

  // This signal only updates when it has seen the current local value
  const $value = $valueFromDocument.derive((valueFromDocument, oldValueFromDocument) => {
    if (localValue === valueFromDocument) dirty = false
    return dirty ? oldValueFromDocument : valueFromDocument
  })

  return [$value, setValue]

  function setValue(value) {
    dirty = true
    localValue = value

    patch({ document, path, value })
  }
}

function patch({ document, path, value }) {
  fetch(`${context.apiPath}/documents/${document.schema.type}/${document.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path,
      value,
      clientId: context.clientId,
    })
  }) // TODO: error reporting
}

function get(o, path) {
  const keys = path.split('/').filter(Boolean)
  return keys.reduce((result, key) => result && result[key], o)
}
