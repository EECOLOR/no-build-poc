import { context } from '#cms/client/context.js'
import { renderOnValue } from '#cms/client/machinery/renderOnValue.js'
import { ButtonChevron } from '#cms/client/ui/Button.js'
import { FlexSectionHorizontal, FlexSectionVertical } from '#cms/client/ui/FlexSection.js'
import { createSignal, Signal } from '#ui/signal.js'
import { css, tags } from '#ui/tags.js'
import { createUniqueId } from '#ui/utils.js'
/** @import { DocumentSchema, FieldTypes } from '#cms/client/cmsConfigTypes.ts' */
/** @import { DocumentContainer, DocumentPath } from '#cms/types.ts' */

const { div, label } = tags

/**
 * @arg {{
 *  document: DocumentContainer,
 *  field: DocumentSchema.Field<DocumentSchema.FieldTypes>,
 *  $path: Signal<DocumentPath>,
 * }} props
 */
export function Field({ document, field, $path }) {
  const renderer = getRenderField(context.fieldTypes, field)
  if (!renderer)
    return div({ style: { backgroundColor: 'lightcoral' } }, `Unknown field type '${field.type}'`)

  const id = createUniqueId()
  const [$expanded, setExpanded] = createSignal(true)

  return (
    FlexSectionVertical({ className: 'Field' },
      Label({ id, field, renderer, $expanded, onExpandClick: () => setExpanded(x => !x) }),
      renderOnValue($expanded, _ =>
        renderer({ document, field, $path, id })
      )
    )
  )
}

Label.style = css`
  justify-content: space-between;
`
/**
 * @arg {{
 *   id: string,
 *   field: DocumentSchema.Field<DocumentSchema.FieldTypes>,
 *   renderer: DocumentSchema.FieldRenderer<DocumentSchema.Field<DocumentSchema.FieldTypes>>,
 *   $expanded: Signal<boolean>,
 *   onExpandClick: () => void,
 * }} props
 */
function Label({ id, field, renderer, $expanded, onExpandClick }) {
  return (
    FlexSectionHorizontal({ className: 'Label', css: Label.style },
      label({ htmlFor: id }, field.title),
      renderer.canCollapse && 'options' in field && field.options.collapsible &&
        ButtonChevron({
          onClick: onExpandClick,
          rotation: $expanded.derive(x => x ? 0 : 180)
        })
    )
  )
}

/**
 * @template {DocumentSchema.FieldTypes} T
 * @param {FieldTypes} fieldTypes
 * @param {DocumentSchema.Field<T>} field
 */
function getRenderField(fieldTypes, field) {
  const info = fieldTypes[field.type]
  return info?.renderField
}
