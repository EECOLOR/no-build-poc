import { useOnDestroy } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'
import { useCombined } from './useCombined.js'

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
 * @param {() => [x, y, width, height]} [getBounds]
 * @param {any} [name]
 */
export function useDrag([initialX, initialY], getBounds = undefined, name = undefined) {
  const [$position, setPosition] = createSignal([initialX, initialY])
  const $translate = $position.derive(([x, y]) => [x - initialX, y - initialY])

  let state = null

  useOnDestroy(removeListeners)

  return { handleMouseDown, $translate, $position, move, name }

  function move(f) {
    if (!getBounds)
      throw new Error(`Can not move a dragable when no 'getBounds' function was given`)

    setPosition(position => getBoundedPosition(f(position), getBounds()))
  }

  function handleMouseDown(e) {
    const parent = e.currentTarget.parentElement.getBoundingClientRect()
    const parentArea = [parent.x, parent.y, parent.width, parent.height]
    state = {
      bounds: getBounds ? getBounds() : parentArea,
      offset: [Math.round(e.offsetX), Math.round(e.offsetY)],
      parent: parentArea,
    }

    addListeners()
    e.preventDefault()
  }

  function addListeners() {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }
  function removeListeners() {
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }

  function handleMouseMove(e) {
    const { offset: [offsetX, offsetY], parent, bounds } = state
    const  [parentX, parentY] = parent
    const localMouseX = Math.round(e.clientX - parentX)
    const localMouseY = Math.round(e.clientY - parentY)

    setPosition(getBoundedPosition([localMouseX - offsetX, localMouseY - offsetY], bounds))
  }

  function handleMouseUp() {
    state = null
    removeListeners()
  }
}

export function useDragableRectangle({ width, height }) {
  const rectangle = useDrag([0, 0], getRectangleBounds)
  const corners = [
    useDrag([0, 0], getTlBounds, 'tl'), useDrag([width, 0], getTrBounds, 'tr'),
    useDrag([0, height], getBlBounds, 'bl'), useDrag([width, height], getBrBounds, 'br')
  ]

  /* TopLeft, TopRight, BottomLeft, BottomRight */
  const [tl, tr, bl, br] = corners

  let movingSiblings = false

  bind(tl, [{ xAxis: bl, yAxis: tr }])
  bind(tr, [{ xAxis: br, yAxis: tl }])
  bind(bl, [{ xAxis: tl, yAxis: br }])
  bind(br, [{ xAxis: tr, yAxis: bl }])

  bind(tl, [{ xAxis: rectangle, yAxis: rectangle }])
  bind(rectangle, [tl, tr, bl, br].map(target =>
    ({ xAxis: target, yAxis: target })
  ))

  const $area = useCombined(tl.$position, br.$position)
    .derive(([[tlX, tlY], [brX, brY]]) =>
      ({ top: tlY, left: tlX, bottom: height - brY, right: width - brX })
    )

  return { corners, rectangle, $area }

  /** @returns {Area } */
  function getTlBounds() {
    const [x, y] = br.$position.get()
    return [0, 0, x, y]
  }
  /** @returns {Area } */
  function getTrBounds() {
    const [x, y] = bl.$position.get()
    return [x, 0, width, y]
  }
  /** @returns {Area } */
  function getBlBounds() {
    const [x, y] = tr.$position.get()
    return [0, y, x, height]
  }
  /** @returns {Area } */
  function getBrBounds() {
    const [x, y] = tl.$position.get()
    return [x, y, width, height]
  }
  /** @returns {Area} */
  function getRectangleBounds() {
    const [left, top] = tl.$position.get()
    const [right, bottom] = br.$position.get()
    return [0, 0, width - (right - left), height - (bottom - top)]
  }

  function bind(corner, axes) {
    corner.$position.subscribeDirect(([newX, newY], [oldX, oldY]) => {
      if (movingSiblings) return
      movingSiblings = true

      for (const { xAxis, yAxis } of axes) {
        xAxis.move(([x, y]) => [x + diff(oldX, newX), y])
        yAxis.move(([x, y]) => [x, y + diff(oldY, newY)])
      }

      movingSiblings = false
    })
  }
}

function diff(oldValue, newValue) {
  return newValue - oldValue
}

function getBoundedPosition([x, y], [areaX, areaY, areaWidth, areaHeight]) {
  return [clamp(areaX, areaWidth, x), clamp(areaY, areaHeight, y)]
}

function clamp(min, max, input) {
  return Math.min(max, Math.max(min, input))
}
