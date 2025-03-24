import { css, tags } from '#ui/tags.js'
import { Field } from './Field.js'
import { FlexSectionHorizontal, FlexSectionProperties, FlexSectionVertical } from '#cms/client/ui/FlexSection.js'
import { indented } from '#cms/client/ui/indented.js'
/** @import { DocumentSchema } from '../../cmsConfigTypes.ts' */

const { strong } = tags

/**
 * @typedef {{
 *   fields: Array<DocumentSchema.Field<DocumentSchema.FieldTypes>>,
 *   options?: {
 *     collapsible?: boolean,
 *     showObjectHeader?: boolean,
 *   },
 * }} ObjectFieldConfig
 */

ObjectField.canCollapse = true
export function ObjectField({ document, field, $path }) {
  return (
    indented.div({ className: 'ObjectField' },
      Object({ document, field, $path })
    )
  )
}

export function Object({ document, field, $path }) {
  return (
    FlexSectionVertical({ className: 'Object' },
      field.options?.showObjectHeader && ObjectHeader({ title: field.title }),
      ObjectFields({ document, fields: field.fields, $path })
    )
  )
}

export function ObjectFields({ document, fields, $path }) {

  return (
    FlexSectionProperties({ className: 'ObjectFields' },
      fields.map(field =>
        Field({ document, field, $path: $path.derive(path => `${path}/${field.name}`) })
      )
    )
  )
}

ObjectHeader.style = css`
  justify-content: space-between;
  align-items: center;
`
function ObjectHeader({ title }) {
  return FlexSectionHorizontal({ className: 'ObjectHeader', css: ObjectHeader.style },
    strong(title),
  )
}
