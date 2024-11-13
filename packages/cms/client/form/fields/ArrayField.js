import { Button, ButtonDelete, ButtonDown, ButtonUp } from '#cms/client/buildingBlocks.js'
import { patchDocument } from '#cms/client/data.js'
import { loop } from '#ui/dynamic.js'
import { useCombined } from '#ui/hooks.js'
import { Signal } from '#ui/signal.js'
import { css, tags } from '#ui/tags.js'
import { createUniqueId } from '#ui/utils.js'
import { Object } from './ObjectField.js'
import { getAtPath } from './utils.js'

const { div } = tags

ArrayField.style = css`& {
  display: flex;
  flex-direction: column;
  gap: var(--default-gap);
  padding-left: var(--default-padding);
  border-left: 1px solid lightgray;

  .buttonContainer {
    margin-top: 1rem;

    & > button {
      width: 100%;
    }
  }
}`
export function ArrayField({ document, field, $path }) {
  const $documentAndPath = useCombined(document.$value, $path)
  const $valueFromDocument = $documentAndPath.derive(([doc, path]) => getAtPath(doc, path) || [])

  return (
    div(
      ArrayField.style,
      loop(
        $valueFromDocument,
        (item) => item._key,
        ($item, key) => {
          const { $isFirst, $isLast, $index } = derivePositionSignals($valueFromDocument, key)
          const type = $item.get()._type // type does not change
          return ArrayItem({
            $isFirst, $isLast, $index,
            document,
            field: field.of.find(x => x.type === type || true),
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
    patchDocument({
      document,
      fieldType: field.type,
      path: `${$path.get()}/${$valueFromDocument.get().length}`,
      value: { _type: type, _key: crypto.randomUUID() }
    })
  }

  function handleMove({ from, to }) {
    patchDocument({ document, fieldType: field.type, from, path: to, op: 'move' })
  }

  function handleDelete({ path }) {
    patchDocument({ document, fieldType: field.type, path, op: 'remove' })
  }
}

ArrayItem.style = css`& {
  display: flex;
  gap: var(--default-gap);

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
        // TODO: seems the up button (and possibly other buttons) causes a referender, probably because a new item is created and the focus is being lost (and with that moved to the next element)
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

/**
 * @param {Signal<Array<{ _key: string }} $items
 */
function derivePositionSignals($items, key) {
  const $lengthAndIndex = $items.derive(
    items => [items.length, items.findIndex(x => x._key === key)]
  )
  return {
    $isFirst: $lengthAndIndex.derive(([length, i]) => !i),
    $isLast: $lengthAndIndex.derive(([length, i]) => i === length - 1),
    $index: $lengthAndIndex.derive(([length, i]) => i),
  }
}
