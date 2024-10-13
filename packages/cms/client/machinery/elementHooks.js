import { useOnDestroy } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'

export function useHasScrollbar() {
  const { $size, ref } = useElementSize()
  const $hasScrollbar = $size.derive(size => Boolean(size) && size.height <= size.element.scrollHeight)

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

/**
 * @typedef {number} x
 * @typedef {number} y
 * @typedef {number} width
 * @typedef {number} height
 * @typedef {[x, y]} Position
 * @typedef {[x, y, width, height]} Area
 */

/**
 * @param {readonly [x, y]} initialPosition
 * @param {object} options
 * @param {() => [x, y, width, height]} [options.getBounds]
 * @param {any} [options.id]
 */
 export function useDrag([initialX, initialY], options = undefined) {
  const [$position, setPosition] = createSignal([initialX, initialY])
  const $translate = $position.derive(([x, y]) => [x - initialX, y - initialY])

  let state = null
  useOnDestroy(removeListeners)

  return {
    handleMouseDown,
    $translate,
    $position,
    move,
    id: options?.id,
  }

  function move(newValueOrFunction) {
    if (!options?.getBounds)
      throw new Error(`Can not move a dragable when no 'getBounds' function was given`)

    setPosition(position => {
      const newValue = typeof newValueOrFunction === 'function'
          ? newValueOrFunction(position)
          : newValueOrFunction

      return getBoundedPosition(newValue, options.getBounds())
    })
  }

  function handleMouseDown(e) {
    const parent = e.currentTarget.parentElement.getBoundingClientRect()
    const parentArea = [parent.x, parent.y, parent.width, parent.height]
    state = {
      offset: [Math.round(e.offsetX), Math.round(e.offsetY)],
      parent: parentArea,
    }

    addListeners()
    e.preventDefault()
  }

  function addListeners() {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', removeListeners)
  }
  function removeListeners() {
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', removeListeners)
    state = null
  }

  function handleMouseMove(e) {
    const { offset: [offsetX, offsetY], parent } = state
    const  [parentX, parentY] = parent
    const localMouseX = Math.round(e.clientX - parentX)
    const localMouseY = Math.round(e.clientY - parentY)
    const bounds = options?.getBounds ? options.getBounds() : parent

    setPosition(getBoundedPosition([localMouseX - offsetX, localMouseY - offsetY], bounds))
  }
}

function getBoundedPosition([x, y], [areaX, areaY, areaWidth, areaHeight]) {
  return [clamp(areaX, areaX + areaWidth, x), clamp(areaY, areaY + areaHeight, y)]
}

function clamp(min, max, input) {
  return Math.min(max, Math.max(min, input))
}
