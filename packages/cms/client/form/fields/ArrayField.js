import { Button, ButtonDelete, ButtonDown, ButtonUp } from '#cms/client/ui/Button.js'
import { patchDocument } from '#cms/client/data.js'
import { loop } from '#ui/dynamic.js'
import { useCombined } from '#ui/hooks.js'
import { Signal } from '#ui/signal.js'
import { css, tags } from '#ui/tags.js'
import { Object } from './ObjectField.js'
import { getAtPath } from './utils.js'
import { FlexSectionBorderedVertical, FlexSectionHorizontal, FlexSectionVertical } from '#cms/client/ui/FlexSection.js'
import { indented } from '#cms/client/ui/indented.js'
/** @import { ObjectFieldConfig } from './ObjectField.js' */
/** @import { DocumentContainer, DocumentPath } from '#cms/types.ts' */
/** @import { DocumentSchema } from '#cms/client/cmsConfigTypes.ts' */

const { div } = tags

/**
 * @typedef {{
 *   of: Array<ArrayObjectConfig>,
 * }} ArrayFieldConfig
 */

/**
 * @typedef {{ type: string, title?: string } & ObjectFieldConfig} ArrayObjectConfig
 */

ArrayField.style = css`
  & > .ArrayActions {
    margin-top: 1rem;
  }
`
/** @arg {{ document: DocumentContainer, field: DocumentSchema.Field<'array'>, $path: Signal<DocumentPath> }} props */
export function ArrayField({ document, field, $path }) {
  const $documentAndPath = useCombined(document.$value, $path)
  const $valueFromDocument = $documentAndPath.derive(([doc, path]) =>
    /** @type {Array<any>} */ (getAtPath(doc, path)) || []
  )

  return (
    indented(FlexSectionBorderedVertical)({ className: 'ArrayField', css: ArrayField.style },
      loop(
        $valueFromDocument,
        (item) => item._key,
        ($item, key) => {
          const { $isFirst, $isLast, $index } = derivePositionSignals($valueFromDocument, key) // TODO: think about this, wouldn't this create signals for every call to this function that will never be removed because 'derive' ties them to the parent signal?
          const type = $item.get()._type // type does not change
          return ArrayItem({
            $isFirst, $isLast, $index,
            document,
            field: field.of.find(x => x.type === type),
            $arrayPath: $path,
            onMove: handleMove,
            onDelete: handleDelete,
          })
        }
      ),
      ArrayActions({ field, onAddClick: handleAdd })
    )
  )

  /** @arg {string} type */
  function handleAdd(type) {
    patchDocument({
      document,
      fieldType: field.type,
      op: 'replace',
      path: `${$path.get()}/${$valueFromDocument.get().length}`,
      value: { _type: type, _key: crypto.randomUUID() },
      valueForDiff: null,
    })
  }

  /** @arg {{ from: string, to: string }} props */
  function handleMove({ from, to }) {
    patchDocument({ document, fieldType: field.type, from, path: to, op: 'move' })
  }

  /** @arg {{ path: string }} props */
  function handleDelete({ path }) {
    patchDocument({ document, fieldType: field.type, path, op: 'remove' })
  }
}

/** @arg {{ field: ArrayFieldConfig, onAddClick: (type: string) => void }} props */
function ArrayActions({ field, onAddClick }) {
  return (
    div({ className: 'ArrayActions'},
      field.of.map(objectType =>
        Button({ label: `Add ${objectType.title}`, onClick: _ => onAddClick(objectType.type) })
      )
    )
  )
}

ArrayItem.style = css`
  & > .Object {
    flex-grow: 1;
  }

  & > .ArrayItemActions {
    align-self: flex-end;
  }
`
/**
 * @arg {{
 *   $isFirst: Signal<boolean>,
 *   $isLast: Signal<boolean>,
 *   document: DocumentContainer,
 *   $arrayPath: Signal<DocumentPath>,
 *   $index: Signal<number>,
 *   field: ArrayObjectConfig,
 *   onMove: (props: { from: string, to: string }) => void,
 *   onDelete: (props: { path: string }) => void,
 * }} props
 */
function ArrayItem({ $isFirst, $isLast, document, $arrayPath, $index, field, onMove, onDelete }) {
  const $arrayPathAndIndex = useCombined($arrayPath, $index)
  const $path = $arrayPathAndIndex.derive(([arrayPath, index]) => `${arrayPath}/${index}`)

  return (
    FlexSectionHorizontal({ className: 'ArrayItem', css: ArrayItem.style },
      Object({ document, field, $path }),
      ArrayItemActions({
        upDisabled: $isFirst,
        downDisabled: $isLast,
        onUpClick: handleUpClick,
        onDownClick: handleDownClick,
        onDeleteClick: handleDeleteClick,
      })
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

  /** @arg {number} toIndex */
  function move(toIndex) {
    const from = $path.get()
    const to = `${$arrayPath.get()}/${toIndex}`
    onMove({ from, to })
  }
}

/**
 * @arg {{
 *   upDisabled: Signal<boolean>,
 *   downDisabled: Signal<boolean>,
 *   onUpClick: () => void,
 *   onDownClick: () => void,
 *   onDeleteClick: () => void,
 * }} props
 */
function ArrayItemActions({ upDisabled, downDisabled, onUpClick, onDownClick, onDeleteClick}) {
  return FlexSectionVertical({ className: 'ArrayItemActions' },
    // TODO: seems the up button (and possibly other buttons) causes a referender, probably because a new item is created and the focus is being lost (and with that moved to the next element)
    ButtonUp({ disabled: upDisabled, onClick: onUpClick }),
    ButtonDown({ disabled: downDisabled, onClick: onDownClick }),
    ButtonDelete({ onClick: onDeleteClick }),
  )
}

/**
 * @arg {Signal<Array<{ _key: string }>>} $items
 * @arg {string} key
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
