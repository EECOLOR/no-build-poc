import { derive, loop } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'
import { tags, css } from '#ui/tags.js'
import { createUniqueId } from '#ui/utils.js'
import { Button, ButtonChevronDown, ButtonChevronUp, ButtonDelete, ButtonDown, ButtonUp } from '../buildingBlocks.js'
import { context } from '../context.js'
import { connecting, useImageMetadata } from '../data.js'
import { debounce } from '../machinery/debounce.js'
import { renderOnValue } from '../machinery/renderOnValue.js'
import { useCombined, useDynamicSignalHook } from '../machinery/signalHooks.js'
import { useEventSourceAsSignal } from '../machinery/useEventSourceAsSignal.js'
import { createImageSrc } from './image/createImgSrc.js'
import { ImageSelector } from './image/ImageSelector.js'
import { RichTextEditor } from './richTextEditor/RichTextEditor.js'

const { div, label, span, input, button, strong, img, form } = tags

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

  const id = createUniqueId()

  return (
    div(
      Field.style,
      label({ htmlFor: id }, span(field.title)),
      renderer({ document, field, $path, id })
    )
  )
}

function StringField({ document, field, $path, id }) {
  const [$value, setValue] = useFieldValue({ document, field, $path, initialValue: '' })

  return input({ id, type: 'text', value: $value, onInput: handleInput })

  function handleInput(e) {
    setValue(e.currentTarget.value)
  }
}

RichTextField.style = css`& {
}`
function RichTextField({ document, field, $path, id }) {
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

ObjectField.style = css`& {
  padding-left: var(--default-padding);
  border-left: 1px solid lightgrey;
}`
function ObjectField({ document, field, $path, id }) {
  return (
    div(
      ObjectField.style,
      Object({ document, field, $path, id })
    )
  )
}

ImageField.style = css`& {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}`
function ImageField({ document, field, $path }) {
  const [$value, setValue] = useFieldValue({
    document, $path, initialValue: null,
    field,
  })

  const $imgSrc = useImgSrc({ $filename: $value, sizeInRem: 25 })

  return (
    div(
      ImageField.style,
      renderOnValue($imgSrc, () => img({ src: $imgSrc })),
      ImageSelector({ onSelect: image => setValue(image.filename) }),
    )
  )
}

function useImgSrc({ $filename, sizeInRem }) {
  const $metadata = useDynamicSignalHook($filename, filename =>
    filename && useImageMetadata({ filename })
  )

  const $imgSrc = useCombined($filename, $metadata)
    .derive(([filename, metadata]) => {
      if (!filename || metadata === connecting)
        return

      const { crop, hotspot } = metadata

      const ratio = crop ? crop.height / crop.width : metadata.height / metadata.width
      const width = Math.round(remToPx(sizeInRem))
      const height = Math.round(ratio * width)

      return createImageSrc(filename, { width, height, crop, hotspot })
    })

  return $imgSrc

  function remToPx(rem) {
    return rem * parseFloat(getComputedStyle(window.document.documentElement).fontSize)
  }
}

function Object({ document, field, $path, id }) {
  const [$expanded, setExpanded] = createSignal(true)

  return (
    div(
      ObjectTitle({ id, title: field.title, $expanded, onExpandClick: _ => setExpanded(x => !x) }),
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
function ObjectTitle({ id, title, $expanded, onExpandClick }) {
  const $Button = $expanded.derive(x => x ? ButtonChevronUp : ButtonChevronDown)

  return strong(
    ObjectTitle.style,
    title,
    derive($Button, Button =>
      Button({ id, onClick: onExpandClick })
    ),
  )
}

ArrayField.style = css`& {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-left: var(--default-padding);
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
            onMove: handleMove,
            onDelete: handleDelete,
          })
        }
      ),
      div({ className: 'buttonContainer'},
        field.of.map(objectType =>
          Button({ label: `Add ${objectType.title}`, onClick: _ => handleAdd(objectType.type) })
        )
      )
    )
  )

  function handleAdd(type) {
    patch({
      document,
      fieldType: field.type,
      path: `${$path.get()}/${$valueFromDocument.get().length}`,
      value: { _type: type, _key: crypto.randomUUID() }
    })
  }

  function handleMove({ from, to }) {
    patch({ document, fieldType: field.type, from, path: to, op: 'move' })
  }

  function handleDelete({ path }) {
    patch({ document, fieldType: field.type, path, op: 'remove' })
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
function ArrayItem({ $isFirst, $isLast, document, $arrayPath, $index, field, onMove, onDelete }) {
  const $arrayPathAndIndex = useCombined($arrayPath, $index)
  const $path = $arrayPathAndIndex.derive(([arrayPath, index]) => `${arrayPath}/${index}`)
  const id = createUniqueId()

  return (
    div(
      ArrayItem.style,
      Object({ document, field, $path, id }),
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
    onDelete({ path: $path.get() })
  }

  function move(toIndex) {
    const from = $path.get()
    const to = `${$arrayPath.get()}/${toIndex}`
    onMove({ from, to })
  }
}

function getRichTextPathname({ document, fieldPath }) {
  // instead of using path as an id for prosemirror document handing, we should probably use a unique id for each document, that would prevent problems handling stuff nested in arrays
  return `documents/${document.schema.type}/${document.id}/rich-text/${encodeURIComponent(fieldPath)}`
}

function useFieldValue({
  document,
  field,
  $path,
  initialValue,
  compareValues = (local, document) => local === document
}) {
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

    patchDebounced({ document, fieldType: field.type, path: $path.get(), value })
  }
}

/**
 * @param {{ document, fieldType } & (
 *   { op?: 'replace', path: string, value: any } |
 *   { op: 'move', from: string, path: string } |
 *   { op: 'remove', path: string }
 * )} params
 */
export function patch(params) {
  const { document, fieldType } = params
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
      fieldType,
    })
  }) // TODO: error reporting
}

function get(o, path) {
  const keys = path.split('/').filter(Boolean)
  return keys.reduce((result, key) => result && result[key], o)
}
