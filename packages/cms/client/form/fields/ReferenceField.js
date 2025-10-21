import { getSchema } from '#cms/client/context.js'
import { useDocuments } from '#cms/client/data.js'
import { loop } from '#ui/dynamic.js'
import { useCombined } from '#ui/hooks.js'
import { Signal } from '#ui/signal.js'
import { tags } from '#ui/tags.js'
import { useFieldValue } from './useFieldValue.js'
/** @import { DocumentSchema } from '#cms/client/cmsConfigTypes.ts' */
/** @import { DocumentContainer, DocumentPath } from '#cms/types.ts' */
/** @import { ChangeEvent } from 'react' */

const { select, option } = tags

/**
 * @typedef {{
 *   title: string,
 *   to: Array<string>,
 * }} ReferenceFieldConfig
 */

/**
 * @arg {{
 *   document: DocumentContainer,
 *   field: DocumentSchema.Field<'reference'>,
 *   $path: Signal<DocumentPath>,
 *   id: string,
 * }} props
 */
export function ReferenceField({ document, field, $path, id }) {
  const [$value, setValue] = useFieldValue({ document, field, $path, initialValue: null })

  const initialOption = { label: 'Select document', value: '' }
  const $documents = useCombined(...field.to.map(type => useDocuments({ schemaType: type })))
    .derive(allDocuments => allDocuments.flat())

  const $options = $documents.derive(documents =>
    [initialOption].concat(
      documents.map(doc => {
        const schema = getSchema(doc._type)
        return { label: schema.preview(doc).title, value: doc._id }
      })
    )
  )

  const $selectedOption = useCombined($value, $options)
    .derive(([value, options]) => options.find(option => option.value === value?.ref))

  return (
    Select({
      $options,
      $selectedOption,
      onChange(option) {
        const document = $documents.get().find(doc => doc._id === option.value)
        setValue({ ref: document._id, type: document._type })
      }
    })
  )
}

/**
 * @arg {{
 *   $options: Signal<Array<{ label: string, value: string }>>,
 *   $selectedOption: Signal<{ label: string, value: string }>,
 *   onChange: (option: { label: string, value: string }) => void,
 * }} props
 * @returns
 */
function Select({ $options, $selectedOption, onChange }) {
  return (
    select({ onChange: handleChange },
      loop($options, x => x.value, ($option, key) =>
        option(
          {
            selected: $selectedOption.derive(selectedOption => selectedOption?.value === key),
            value: key
          },
          $option.derive(option => option.label)
        )
      )
    )
  )

  /** @arg {ChangeEvent<HTMLSelectElement>} e */
  function handleChange(e) {
    const option = $options.get().find(option => option.value === e.currentTarget.value)
    onChange(option)
  }
}
