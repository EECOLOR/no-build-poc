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

Field.style = css`
  display: flex;
  flex-direction: column;
`
export function Field({ document, field, $path }) {
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
