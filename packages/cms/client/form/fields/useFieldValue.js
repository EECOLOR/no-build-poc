import { patchDocument } from '#cms/client/data.js'
import { debounce } from '#cms/client/machinery/debounce.js'
import { useCombined } from '#ui/hooks.js'
import { getAtPath } from './utils.js'
/** @import { Signal } from '#ui/signal.js' */

// TODO: think: if we don't send updates to ourselves, we don't need to check for dirtyness
// - maybe useFieldValue is used in other places as well. We like the reactivity from the server,
//   even for our own changes.

export function useFieldValue({
  document,
  field,
  $path,
  initialValue,
  compareValues = (local, document) => local === document
}) {
  const $documentAndPath = useCombined(document.$value, $path)
  const $valueFromDocument = $documentAndPath.derive(([doc, path]) => getAtPath(doc, path) || initialValue)
  let localValue = $valueFromDocument.get()
  let dirty = false

  const patchDocumentDebounced = debounce(patchDocument, 300)

  // This signal only updates when it has seen the current local value
  const $value = useConditionalDerive(
    $valueFromDocument,
    function shouldUpdate(valueFromDocument) {
      if (compareValues(localValue, valueFromDocument))
        dirty = false

      return !dirty
    }
  )

  return /** @type const */ ([$value, setValue])

  function setValue(value) {
    dirty = true
    localValue = value

    patchDocumentDebounced({ document, fieldType: field.type, path: $path.get(), value })
  }
}

/**
 * @template X
 * @param {Signal<X>} signal
 * @param {(newValue: X, oldValue: X) => Boolean} shouldUpdate
 */
export function useConditionalDerive(signal, shouldUpdate) {
  let oldValue = signal.get()
  return signal.derive(newValue => {
    if (shouldUpdate(newValue, oldValue))
      oldValue = newValue

    return oldValue
  })
}
