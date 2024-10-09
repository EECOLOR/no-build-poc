import { useOnDestroy } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'

export function useHasScrollbar() {
  const [$hasScrollbar, setHasScrollbar] = createSignal(false)
  const observer = new window.ResizeObserver(([entry]) => update(entry.target))

  useOnDestroy(() => observer.disconnect())

  return { ref, $hasScrollbar }

  function ref(element) {
    observer.disconnect()
    if (!element) return

    update(element)
    observer.observe(element)
  }

  function update(target) {
    setHasScrollbar(target.getBoundingClientRect().height < target.scrollHeight)
  }
}
