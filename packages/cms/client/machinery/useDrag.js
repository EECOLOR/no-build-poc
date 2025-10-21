import { asConst } from '#typescript/helpers.js'
import { useOnDestroy } from '#ui/dynamic.js'
import { createSignal, Signal } from '#ui/signal.js'

/**
 * @typedef {number} x
 * @typedef {number} y
 * @typedef {number} width
 * @typedef {number} height
 * @typedef {readonly [x, y]} Position
 * @typedef {readonly [x, y, width, height]} Area
 */

/**
 * @typedef {{
 *   handleMouseDown: (e: MouseEvent) => void,
 *   $translate: Signal<Position>,
 *   $position: Signal<Position>,
 *   move: (newValueOrFunction: Position | ((position: Position) => Position)) => void,
 *   id?: string,
 * }} DragHandle
 */

/**
 * @arg {Position} initialPosition
 * @arg {object} options
 * @arg {() => Area} [options.getBounds]
 * @arg {any} [options.id]
 */
export function useDrag([initialX, initialY], options = undefined) {
  const [$position, setPosition] = createSignal(/** @type {Position} */ ([initialX, initialY]), pointsEqual)
  const $translate = $position.derive(([x, y]) => asConst([x - initialX, y - initialY]))

  let state = /** @type {{ offset: Position, parent: Area }} */ (null)
  useOnDestroy(removeListeners)

  return {
    handleMouseDown,
    $translate,
    $position,
    move,
    id: options?.id,
  }

  /** @param {Position | ((position: Position) => Position)} newValueOrFunction */
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

  /** @param {MouseEvent} e */
  function handleMouseDown(e) {
    if (!(e.currentTarget instanceof HTMLElement))
      return

    const parent = e.currentTarget.parentElement.getBoundingClientRect()
    const parentArea = /** @type const */ ([parent.x, parent.y, parent.width, parent.height])
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

  /** @param {MouseEvent} e */
  function handleMouseMove(e) {
    const { offset: [offsetX, offsetY], parent } = state
    const  [parentX, parentY] = parent
    const localMouseX = Math.round(e.clientX - parentX)
    const localMouseY = Math.round(e.clientY - parentY)
    const bounds = options?.getBounds ? options.getBounds() : parent

    setPosition(getBoundedPosition([localMouseX - offsetX, localMouseY - offsetY], bounds))
  }
}

/** @param {Position} p1 @param {Position} p2 */
function pointsEqual([x1, y1], [x2, y2]) {
  return x1 === x2 && y1 === y2
}

/** @param {Position} position @param {Area} bounds @returns {Position} */
function getBoundedPosition([x, y], [areaX, areaY, areaWidth, areaHeight]) {
  return [clamp(areaX, areaX + areaWidth, x), clamp(areaY, areaY + areaHeight, y)]
}

/** @param {number} min @param {number} max @param {number} input */
function clamp(min, max, input) {
  return Math.min(max, Math.max(min, input))
}
