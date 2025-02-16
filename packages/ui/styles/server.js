import { useOnDestroy } from '#ui/dynamic.js'
import { raw, tags } from '#ui/tags.js'
import { startStyleCapture } from './shared.js'

/** @param {() => any} f */
export function ServerStyles(f) {
  const [result, styles, stopStyleCapture] = withStyleCapture(f)

  useOnDestroy(stopStyleCapture)

  return [
    tags['style-container'](styles),
    result,
  ]
}

function withStyleCapture(f) {
  const styles = []
  const stopStyleCapture = startStyleCapture({
    addStyle(className, content) {
      styles.push(
        tags.style({ id: className}, raw(content))
      )
    },
    removeStyle(className) {
      // Will not remove styles, we stop capturing
    }
  })
  const result = f() // TODO: try / finally ?

  return /** @type {const} */ ([result, styles, stopStyleCapture])
}
