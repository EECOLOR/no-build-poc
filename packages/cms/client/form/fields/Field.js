import { renderOnValue } from '#cms/client/machinery/renderOnValue.js'
import { ButtonChevron } from '#cms/client/ui/Button.js'
import { FlexSectionHorizontal, FlexSectionVertical } from '#cms/client/ui/FlexSection.js'
import { createSignal } from '#ui/signal.js'
import { css, tags } from '#ui/tags.js'
import { createUniqueId } from '#ui/utils.js'
import { ArrayField } from './ArrayField.js'
import { ImageField } from './ImageField.js'
import { ObjectField } from './ObjectField.js'
import { ReferenceField } from './ReferenceField.js'
import { RichTextField } from './RichTextField.js'
import { StringField } from './StringField.js'

const { div, label, span } = tags

const fieldRenderers = /** @type {const} */({
  'string': StringField,
  'rich-text': RichTextField,
  'array': ArrayField,
  'image': ImageField,
  'reference': ReferenceField,
  default: ObjectField,
})

export function Field({ document, field, $path }) {
  let renderer = fieldRenderers[field.type]
  if (!renderer && 'fields' in field)
    renderer = fieldRenderers.default
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
