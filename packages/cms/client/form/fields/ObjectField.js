import { css, tags } from '#ui/tags.js'
import { Field } from './Field.js'
import { FlexSectionHorizontal, FlexSectionProperties, FlexSectionVertical } from '#cms/client/ui/FlexSection.js'
import { indented } from '#cms/client/ui/indented.js'
import { Signal } from '#ui/signal.js'
/** @import { DocumentSchema } from '../../cmsConfigTypes.ts' */
/** @import { DocumentContainer, DocumentPath } from '#cms/types.ts' */

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
/**
 * @arg {{
 *   document: DocumentContainer,
 *   field: DocumentSchema.Field<'object'>,
 *   $path: Signal<DocumentPath>,
 * }} props
 */
export function ObjectField({ document, field, $path }) {
  return (
    indented.div({ className: 'ObjectField' },
      Object({ document, field, $path })
    )
  )
}

/**
 * @arg {{
*   document: DocumentContainer,
*   field: { title?: string } & ObjectFieldConfig,
*   $path: Signal<DocumentPath>,
* }} props
*/
export function Object({ document, field, $path }) {
  return (
    FlexSectionVertical({ className: 'Object' },
      field.options?.showObjectHeader && ObjectHeader({ title: field.title }),
      ObjectFields({ document, fields: field.fields, $path })
    )
  )
}

/**
 * @arg {{
*   document: DocumentContainer,
*   fields: Array<DocumentSchema.Field<DocumentSchema.FieldTypes>>,
*   $path: Signal<DocumentPath>,
* }} props
*/
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
/** @arg {{ title: string }} props */
function ObjectHeader({ title }) {
  return FlexSectionHorizontal({ className: 'ObjectHeader', css: ObjectHeader.style },
    strong(title),
  )
}
