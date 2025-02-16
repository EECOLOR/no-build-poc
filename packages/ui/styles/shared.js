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

export function useStyle(style) {
  const target = capturedStyles[capturedStyles.length - 1]
  if (!target)
    throw new Error(`useStyle was called while not capturing styles. On the server make sure you have ServerStyles wrapped around the components that use style`)

  const [className, content] = getClassNameAndContent(style)

  target.addStyle(className, content)
  useOnDestroy(() =>
    target.removeStyle(className)
  )

  return className
}

function getClassNameAndContent(style) {
    const content = Array.isArray(style) ? style.join('\n') : style
    const hash = createHash(content)
    const className = 'c_' + hash

    return [className, content]
}

function wrapInClass(className, content) {
  return (
    `.${className} {\n` +
    `  ${content.split('\n').join('\n  ')}\n` +
    `}`
  )
}
