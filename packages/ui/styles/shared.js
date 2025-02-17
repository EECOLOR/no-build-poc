/** @import { TypeOrArrayOfType } from '#ui/types.ts' */
import { useOnDestroy } from '#ui/dynamic.js'
import { createHash } from '#utils/createHash.js'

/** @typedef {{ className: string, content: string }} StyleObject */

/**
 * @type {Array<
 *   {
 *     addStyle(className: string, content: string): void
 *     removeStyle(className: string): void
 *    }
 *  >}
 */
const capturedStyles = []
const MAX_FLAT = 100 // Something is probably wrong if we go beyond a 100 deep

/**
 * @param {{
 *   addStyle(className, content): void
 *   removeStyle(className): void
 * }} props
 */
export function startStyleCapture(props) {
  const captured = new Map()

  capturedStyles.push({ addStyle, removeStyle })

  return stopCapturing

  function stopCapturing() {
    capturedStyles.pop()
  }

  /** @param {string} className @param {string} content */
  function addStyle(className, content) {
    if (!captured.has(className)) {
      captured.set(className, 0)
      props.addStyle(className, wrapInClass(className, content))
    }

    captured.set(className, captured.get(className) + 1)
  }

  /** @param {string} className */
  function removeStyle(className) {
    const newCount = captured.get(className) - 1
    if (newCount)
      return captured.set(className, newCount)

    captured.delete(className)
    props.removeStyle(className)
  }
}

/** @param {TypeOrArrayOfType<string>} styleOrStyles Can actually be arrays nested to infinity, but that can not be expressed in JSdoc, we might want to do that in a .ts file */
export function useStyle(styleOrStyles) {
  const target = capturedStyles[capturedStyles.length - 1]
  if (!target)
    throw new Error(`useStyle was called while not capturing styles. On the server make sure you have ServerStyles wrapped around the components that use style`)

  const styles = Array.isArray(styleOrStyles) ? styleOrStyles : [styleOrStyles]
  const styleInfo = styles.flat(MAX_FLAT).filter(Boolean).map(getClassNameAndContent)
  const classNames = []
  for (const { className, content } of styleInfo) {
    target.addStyle(className, content)
    classNames.push(className)
  }

  useOnDestroy(() => {
    for (const className of classNames) {
      target.removeStyle(className) // TODO: should we actually remove the styles? From a purist point of view we do, but it doesn't actually make a lot of sense. It's more computationally expensive to remove and add them while it probably does not make a significant impact on memory usage.
    }
  })

  return classNames.join(' ')
}

function getClassNameAndContent(content) {
    const hash = createHash(content)
    const className = 'c_' + hash

    return { className, content }
}

function wrapInClass(className, content) {
  return `.${className} {${content}}`
}
