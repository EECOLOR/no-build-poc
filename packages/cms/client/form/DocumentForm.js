import { conditional, derive, loop } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'
import { tags, css } from '#ui/tags.js'
import { ButtonChevronDown, ButtonChevronUp, ButtonDelete, ButtonDown, ButtonUp } from '../buildingBlocks.js'
import { context } from '../context.js'
import { debounce } from '../machinery/debounce.js'
import { renderOnValue } from '../machinery/renderOnValue.js'
import { useCombined } from '../machinery/useCombined.js'
import { useEventSourceAsSignal } from '../machinery/useEventSourceAsSignal.js'
import { RichTextEditor } from './richTextEditor/RichTextEditor.js'

const { div, h1, label, span, input, button, strong , img} = tags

DocumentForm.style = css`& {
  min-width: 25rem;
  max-width: 35rem;

  & > :last-child {
    margin-top: 1rem;
  }
}`
export function DocumentForm({ document }) {
  return (
    div(// TODO: use context.documentView
      DocumentForm.style,
      DocumentFields({ document }),
    )
  )
}

function DocumentFields({ document }) {
  const [$path] = createSignal('')
  return ObjectFields({ document, fields: document.schema.fields, $path })
}

ObjectFields.style = css`& {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}`
function ObjectFields({ document, fields, $path }) {

  return (
    div(
      ObjectFields.style,
      fields.map(field =>
        Field({ document, field, $path: $path.derive(path => `${path}/${field.name}`) })
      )
    )
  )
}

const fieldRenderers = /** @type {const} */({
  'string': StringField,
  'rich-text': RichTextField,
  'array': ArrayField,
  'image': ImageField,
  default: ObjectField,
})

Field.style = css`& {
  display: flex;
  flex-direction: column;
}`
function Field({ document, field, $path }) {
  let renderer = fieldRenderers[field.type]
  if (!renderer && 'fields' in field)
    renderer = fieldRenderers.default
  if (!renderer)
    return div({ style: { backgroundColor: 'lightcoral' } }, `Unknown field type '${field.type}'`)

  return (
    label(
      Field.style,
      span(field.title),
      renderer({ document, field, $path })
    )
  )
}

function StringField({ document, field, $path }) {
  const [$value, setValue] = useFieldValue({ document, $path, initialValue: '' })

  return input({ type: 'text', value: $value, onInput: handleInput })

  function handleInput(e) {
    setValue(e.currentTarget.value)
  }
}

RichTextField.style = css`& {
}`
function RichTextField({ document, field, $path }) {
  const $richTextPathname = $path.derive(path => getRichTextPathname({ document, fieldPath: path }))

  const $events = useEventSourceAsSignal({
    pathnameSignal: $richTextPathname,
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
  return renderOnValue($initialValue, initialValue =>
    div(
      RichTextField.style,
      RichTextEditor({ initialValue, $steps, synchronize }),
    )
  )

  function synchronize({ clientId, steps, version, value }) {
    const controller = new AbortController()
    const result = fetch(
      $richTextPathname.get(),
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

ObjectField.style = css`& {
  padding-left: 0.5rem;
  border-left: 1px solid lightgrey;
}`
function ObjectField({ document, field, $path }) {
  return (
    div(
      ObjectField.style,
      Object({ document, field, $path })
    )
  )
}

function ImageField({ document, field, $path }) {
  const [$value, setValue] = useFieldValue({
    document, $path, initialValue: null,
    compareValues: (local, document) => local?.filename === document?.filename
  })

  return (
    div(
      conditional(
        $value,
        value => value?.filename,
        value =>
          img({ src: `${context.apiPath}/images/${value.filename}` })
      ),
      input({
        type: 'file',
        onChange: handleFileChange,
        accept:'image/jpeg,image/png,image/webp,image/bmp'
      })
    )
  )

  async function handleFileChange(e) {
    /** @type {Array<File>} */
    const [file] = e.currentTarget.files
    if (!file)
      return

    // TODO: prevent large files from being uploaded

    const response = await fetch(`${context.apiPath}/images?${new URLSearchParams({ name: file.name })}`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type,
        'Content-Length': String(file.size),
      },
      body: file,
    }) // TODO: error handling

    if (!response.ok) {
      throw new Error(`Image upload failed [${response.status}]\n${await response.text()}`)
    }

    setValue(await response.json())
  }
}

function Object({ document, field, $path }) {
  const [$expanded, setExpanded] = createSignal(true)

  return (
    div(
      ObjectTitle({ title: field.title, $expanded, onExpandClick: _ => setExpanded(x => !x) }),
      renderOnValue($expanded,
        _ => ObjectFields({ document, fields: field.fields, $path })
      )
    )
  )
}

ObjectTitle.style = css`& {
  display: flex;
  justify-content: space-between;
  align-items: center;
}`
function ObjectTitle({ title, $expanded, onExpandClick }) {
  const $Button = $expanded.derive(x => x ? ButtonChevronUp : ButtonChevronDown)

  return strong(
    ObjectTitle.style,
    title,
    derive($Button, Button =>
      Button({ onClick: onExpandClick })
    )
  )
}

ArrayField.style = css`& {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-left: 0.5rem;
  border-left: 1px solid lightgray;

  .buttonContainer {
    margin-top: 1rem;

    & > button {
      width: 100%;
    }
  }
}`
function ArrayField({ document, field, $path }) {
  const $documentAndPath = useCombined(document.$value, $path)
  const $valueFromDocument = $documentAndPath.derive(([doc, path]) => get(doc, path) || [])

  return (
    div(
      ArrayField.style,
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
            $arrayPath: $path,
          })
        }
      ),
      div({ className: 'buttonContainer'},
        field.of.map(objectType =>
          button({ type: 'button', onClick: _ => handleAdd(objectType.type) },
            css`& {
              border: 1px solid black;
              border-radius: 5px;
              padding: 0.2rem;
            }`,
            `Add ${objectType.title}`
          )
        )
      )
    )
  )

  function handleAdd(type) {
    patch({
      document,
      path: `${$path.get()}/${$valueFromDocument.get().length}`,
      value: { _type: type, _key: crypto.randomUUID() }
    })
  }
}

ArrayItem.style = css`& {
  display: flex;
  gap: 0.5rem;

  & > :nth-child(2) {
    flex-grow: 1;
  }

  .buttonContainer {
    align-self: flex-end;

    display: flex;
    flex-direction: column;
  }
}`
function ArrayItem({ $isFirst, $isLast, document, $arrayPath, $index, field }) {
  const $arrayPathAndIndex = useCombined($arrayPath, $index)
  const $path = $arrayPathAndIndex.derive(([arrayPath, index]) => `${arrayPath}/${index}`)
  return (
    div(
      ArrayItem.style,
      Object({ document, field, $path }),
      div({ className: 'buttonContainer' },
        ButtonUp({ disabled: $isFirst, onClick: handleUpClick }),
        ButtonDown({ disabled: $isLast, onClick: handleDownClick }),
        ButtonDelete({ onClick: handleDeleteClick }),
      )
    )
  )

  function handleUpClick() {
    move($index.get() - 1)
  }

  function handleDownClick() {
    move($index.get() + 1)
  }

  function handleDeleteClick() {
    patch({ document, path: $path.get(), op: 'remove' })
  }

  function move(toIndex) {
    const from = $path.get()
    const to = `${$arrayPath.get()}/${toIndex}`
    patch({ document, from, path: to, op: 'move' })
  }
}

function getRichTextPathname({ document, fieldPath }) {
  // instead of using path as an id for prosemirror document handing, we should probably use a unique id for each document, that would prevent problems handling stuff nested in arrays
  return `${context.apiPath}/documents/${document.schema.type}/${document.id}/rich-text?fieldPath=${fieldPath}`
}

function useFieldValue({ document, $path, initialValue, compareValues = (local, document) => local === document }) {
  const $documentAndPath = useCombined(document.$value, $path)
  const $valueFromDocument = $documentAndPath.derive(([doc, path]) => get(doc, path) || initialValue)
  let localValue = $valueFromDocument.get()
  let dirty = false

  const patchDebounced = debounce(patch, 300)

  // This signal only updates when it has seen the current local value
  const $value = $valueFromDocument.derive((valueFromDocument, oldValueFromDocument) => {
    if (compareValues(localValue, valueFromDocument)) dirty = false
    return dirty ? oldValueFromDocument : valueFromDocument
  })

  return /** @type const */ ([$value, setValue])

  function setValue(value) {
    dirty = true
    localValue = value

    patchDebounced({ document, path: $path.get(), value })
  }
}

/**
 * @param {{ document } & (
 *   { op?: 'replace', path: string, value: any } |
 *   { op: 'move', from: string, path: string } |
 *   { op: 'remove', path: string }
 * )} params
 */
export function patch(params) {
  const { document } = params
  const { op = 'replace', path, value, from } = /** @type {typeof params & { value?: any, from?: any }} */ (params)
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
