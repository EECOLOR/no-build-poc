import { patchDocument } from '#cms/client/data.js'
import { debounce } from '#cms/client/machinery/debounce.js'
import { useCombined } from '#ui/hooks.js'
import { getAtPath } from './utils.js'
import { createSignal } from '#ui/signal.js'
import { useOnDestroy } from '#ui/dynamic.js'
/** @import { Signal } from '#ui/signal.js' */

// TODO: think: if we don't send updates to ourselves, we don't need to check for dirtyness
// - maybe useFieldValue is used in other places as well. We like the reactivity from the server,
//   even for our own changes.

export function useFieldValue({
  document,
  field,
  $path,
  initialValue,
  compareValues = (local, document) => local === document,
  serializeValue = value => value,
  extractValueForDiff = value => value,
}) {
  const $documentAndPath = useCombined(document.$value, $path)
  const $valueFromDocument = $documentAndPath.derive(([doc, path]) => getAtPath(doc, path) || initialValue)
  let localValue = $valueFromDocument.get()
  let dirty = false

  // TODO: error reporting
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

  function setValue(rawValue) {
    dirty = true
    localValue = rawValue

    const valueForDiff = extractValueForDiff(rawValue)
    const value = serializeValue(rawValue)

    patchDocumentDebounced({ document, fieldType: field.type, path: $path.get(), value, valueForDiff })
  }
}

/**
 * @template X
 * @param {Signal<X>} signal
 * @param {(newValue: X, oldValue: X) => Boolean} shouldUpdate
 */
export function useConditionalDerive(signal, shouldUpdate) {
  const [$value, setValue] = createSignal(signal.get())

  const unsubscribe = signal.subscribe(newValue => {
    if (shouldUpdate(newValue, $value.get()))
      setValue(newValue)
  })

  useOnDestroy(unsubscribe)

  return $value
}
