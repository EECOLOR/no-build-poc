import { loop } from '#ui/dynamic.js'
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
  const $title = document.$value.derive(doc => document.schema.preview(doc).title)
  return h1($title, button({ type: 'button', onClick: handleClick }, '🗑'))

  function handleClick() {
    patch({ document, path: '', op: 'remove', value: undefined,  })
  }
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
  'array': ArrayField,
  default: ObjectField,
})

function Field({ document, field, path }) {
  let renderer = fieldRenderers[field.type]
  if (!renderer && 'fields' in field)
    renderer = fieldRenderers.default
  if (!renderer)
    return div({ style: { backgroundColor: 'lightcoral' } }, `Unknown field type '${field.type}'`)

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
          documentVersion: document.$value.get().version,
          valueVersion: version,
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

function ArrayField({ document, field, path }) {
  const $valueFromDocument = document.$value.derive(doc => get(doc, path) || [])

  return (
    div(
      loop(
        $valueFromDocument,
        (item, i) => item._key || i, // TODO: introduce _key to array so we do not rerender on a move
        (item , i, items) => {
          const $lengthAndIndex = $valueFromDocument.derive(
            items => [items.length, items.findIndex(x => x._key === item._key)]
          )
          return ArrayItem({
            $isFirst: $lengthAndIndex.derive(([length, i]) => !i),
            $isLast: $lengthAndIndex.derive(([length, i]) => i === length - 1),
            $index: $lengthAndIndex.derive(([length, i]) => i),
            document,
            field: field.of.find(x => x.type === item?._type || true),
            arrayPath: path,
          })
        }
      ),
      field.of.map(objectType =>
        button({ type: 'button', onClick: _ => handleAdd(objectType.type) }, `Add ${objectType.title}`)
      )
    )
  )

  function handleAdd(type) {
    patch({
      document,
      path: `${path}/${$valueFromDocument.get().length}`,
      value: { _type: type, _key: crypto.randomUUID() }
    })
  }
}

function ArrayItem({ $isFirst, $isLast, document, arrayPath, $index, field }) {
  return (
    div(
      ObjectField({ document, field, path: `${arrayPath}/${$index.get()}` }), // TODO: path should be a signal
      button({ type: 'button', disabled: $isFirst, onClick: handleUpClick }, '🡅'),
      button({ type: 'button', disabled: $isLast, onClick: handleDownClick }, '🡇'),
    )
  )

  function handleUpClick() {
    const from = `${arrayPath}/${$index.get()}`
    const to = `${arrayPath}/${$index.get() - 1}`
    patch({ document, from, path: to, op: 'move', value: undefined })
  }

  function handleDownClick() {
    const from = `${arrayPath}/${$index.get()}`
    const to = `${arrayPath}/${$index.get() + 1}`
    patch({ document, from, path: to, op: 'move', value: undefined })
  }
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

function patch({ document, path, value, op = 'replace', from = undefined }) {
  // TODO: add retries if the versions do not match
  fetch(`${context.apiPath}/documents/${document.schema.type}/${document.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: document.$value.get()?.version ?? 0,
      patch: { op, path, value, from },
      clientId: context.clientId,
    })
  }) // TODO: error reporting
}

function get(o, path) {
  const keys = path.split('/').filter(Boolean)
  return keys.reduce((result, key) => result && result[key], o)
}
