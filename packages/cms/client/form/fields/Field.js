import { context } from '#cms/client/context.js'
import { renderOnValue } from '#cms/client/machinery/renderOnValue.js'
import { ButtonChevron } from '#cms/client/ui/Button.js'
import { FlexSectionHorizontal, FlexSectionVertical } from '#cms/client/ui/FlexSection.js'
import { createSignal } from '#ui/signal.js'
import { css, tags } from '#ui/tags.js'
import { createUniqueId } from '#ui/utils.js'
/** @import { DocumentSchema, FieldTypes } from '#cms/client/cmsConfigTypes.ts' */

const { div, label } = tags

export function Field({ document, field, $path }) {
  const renderer = getRenderField(context.fieldTypes, field)
  if (!renderer)
    return div({ style: { backgroundColor: 'lightcoral' } }, `Unknown field type '${field.type}'`)

  const id = createUniqueId()
  const [$expanded, setExpanded] = createSignal(true)

  return (
    FlexSectionVertical({ className: 'Field' },
      Label({ id, field, renderer, $expanded, onExpandClick: _ => setExpanded(x => !x) }),
      renderOnValue($expanded, _ =>
        renderer({ document, field, $path, id })
      )
    )
  )
}

Label.style = css`
  justify-content: space-between;
`
function Label({ id, field, renderer, $expanded, onExpandClick }) {
  return (
    FlexSectionHorizontal({ className: 'Label', css: Label.style },
      label({ htmlFor: id }, field.title),
      renderer.canCollapse && field.options?.collapsible &&
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
