import { loop } from '#ui/dynamic.js'
import { render } from '#ui/render/clientRenderer.js'
import { createSignal } from '#ui/signal.js'
import { raw, tags } from '#ui/tags.js'
import { startStyleCapture } from './shared.js'

export function startStyleHandling() {
  const [dynamicStyleContainer, renderedStyles] = collectRenderedStyles()
  const [$dynamicStyles, setDynamicStyles] = createSignal([])
  const stopCapturing = startStyleCapture({
    addStyle(className, content) {
      if (renderedStyles.has(className))
        return

      setDynamicStyles(styles => styles.concat({ className, content }))
    },
    removeStyle(className) {
      if (renderedStyles.has(className))
        return // We do not want to remove styles on the page, they may apply to static elements

      setDynamicStyles(styles => styles.filter(style => style.className !== className))
    },
  })

  const rendered = render(() =>
    loop(
      $dynamicStyles,
      style => style.className,
      $style => tags.style(raw($style.get().content))
    )
  )
  dynamicStyleContainer.append(...rendered.result)

  return function stopStyleHandling() {
    console.log('stopping')
    stopCapturing()
    rendered.destroy()
    for (const node of rendered.result)
      node.remove()
  }
}

function collectRenderedStyles() {
  const renderedStyles = new Set()
  let lastStyleContainer = null
  for (const styleContainer of document.querySelectorAll('style-container')) {
    lastStyleContainer = styleContainer

    for (const child of styleContainer.children) {
      const { id } = child
      if (!id)
        throw new Error(`Found element in style container without id:\n${child.outerHTML}`)

      if (renderedStyles.has(id)) child.remove()
      else renderedStyles.add(id)
    }
  }

  return /** @type {const} */ ([lastStyleContainer || document.head, renderedStyles])
}
