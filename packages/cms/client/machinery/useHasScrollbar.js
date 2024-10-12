import { useOnDestroy } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'

export function useHasScrollbar() {
  const { $size, ref } = useElementSize()
  const $hasScrollbar = $size.derive(size => Boolean(size) && size.height < size.element.scrollHeight)


  return { ref, $hasScrollbar }
}

export function useElementSize() {
  const [$size, setSize] = createSignal(null)

  const observer = new window.ResizeObserver(([entry]) => update(entry.target))
  useOnDestroy(() => observer.disconnect())

  return { ref, $size }

  function ref(element) {
    observer.disconnect()
    if (!element) return setSize(null)

    update(element)
    observer.observe(element)
  }

  function update(target) {
    setSize({ width: target.offsetWidth, height: target.offsetHeight, element: target })
  }
}
