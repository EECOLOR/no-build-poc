import { tags } from '#ui/tags.js'
import { useFieldValue } from './useFieldValue.js'

const { input } = tags

/** @typedef {{}} StringFieldConfig */

export function StringField({ document, field, $path, id }) {
  const [$value, setValue] = useFieldValue({ document, field, $path, initialValue: '' })

  return input({ id, type: 'text', value: $value, onInput: handleInput })

  function handleInput(e) {
    setValue(e.currentTarget.value)
  }
}
