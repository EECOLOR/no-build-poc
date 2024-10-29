import { useOnDestroy } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'

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
  const [$position, setPosition] = createSignal([initialX, initialY], pointsEqual)
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

function pointsEqual([x1, y1], [x2, y2]) {
  return x1 === x2 && y1 === y2
}

function getBoundedPosition([x, y], [areaX, areaY, areaWidth, areaHeight]) {
  return [clamp(areaX, areaX + areaWidth, x), clamp(areaY, areaY + areaHeight, y)]
}

function clamp(min, max, input) {
  return Math.min(max, Math.max(min, input))
}
