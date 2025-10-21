import { Signal } from '#ui/signal.js'
import { tags } from '#ui/tags.js'
import { useFieldValue } from './useFieldValue.js'
/** @import { DocumentContainer, DocumentPath } from '#cms/types.ts' */
/** @import { DocumentSchema } from '#cms/client/cmsConfigTypes.ts' */
/** @import { FormEvent } from 'react' */

const { input } = tags

/** @typedef {{}} StringFieldConfig */

/**
 * @arg {{
 *   document: DocumentContainer,
 *   field: DocumentSchema.Field<'string'>,
 *   $path: Signal<DocumentPath>,
 *   id: string,
 * }} props
 */
export function StringField({ document, field, $path, id }) {
  const [$value, setValue] = useFieldValue({ document, field, $path, initialValue: '' })

  return input({ id, type: 'text', value: $value, onInput: handleInput })

  /** @arg {FormEvent<HTMLInputElement>} e */
  function handleInput(e) {
    setValue(e.currentTarget.value)
  }
}
