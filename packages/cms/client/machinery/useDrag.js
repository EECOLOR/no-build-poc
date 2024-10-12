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
 * @param {any} [id]
 */
export function useDrag([initialX, initialY], getBounds = undefined, id = undefined) {
  const [$position, setPosition] = createSignal([initialX, initialY])
  const $translate = $position.derive(([x, y]) => [x - initialX, y - initialY])

  let state = null

  useOnDestroy(removeListeners)

  return { handleMouseDown, $translate, $position, move, id }

  function move(newValueOrFunction) {
    if (!getBounds)
      throw new Error(`Can not move a dragable when no 'getBounds' function was given`)

    setPosition(position => {
      const newValue = typeof newValueOrFunction === 'function'
          ? newValueOrFunction(position)
          : newValueOrFunction

      return getBoundedPosition(newValue, getBounds())
    })
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

/**
 * @param {{ width: number, height: number }} bounds
 * @param {{ x: number, y: number, width: number, height: number }} initialRectangle
 */
export function useDragableRectangle(bounds, initialRectangle) {
  const { width, height } = bounds
  const [tlPos, trPos, blPos, brPos] = getInitialPositions(initialRectangle)

  const rectangle = useDrag(tlPos, getRectangleBounds)
  const corners = [
    useDrag(tlPos, getTlBounds, 'tl'), useDrag(trPos, getTrBounds, 'tr'),
    useDrag(blPos, getBlBounds, 'bl'), useDrag(brPos, getBrBounds, 'br')
  ]

  /* TopLeft, TopRight, BottomLeft, BottomRight */
  const [tl, tr, bl, br] = corners

  let movingSiblings = false

  const $minMax = useCombined(tl.$position, br.$position)

  const $area = $minMax
    .derive(([[minX, minY], [maxX, maxY]]) =>
      ({ x: minX, y: minY, width: maxX - minX, height: maxX - minY })
    )

  const $inset = $minMax.derive(([[minX, minY], [maxX, maxY]]) =>
    ({ top: minY, left: minX, bottom: height - maxY, right: width - maxX })
  )

  const subscriptions = [
    bind(tl, { xAxis: bl, yAxis: tr }),
    bind(tr, { xAxis: br, yAxis: tl }),
    bind(bl, { xAxis: tl, yAxis: br }),
    bind(br, { xAxis: tr, yAxis: bl }),

    bind(tl, { xAxis: rectangle, yAxis: rectangle }),
    bindRectangle(),
  ]

  useOnDestroy(() => {
    for (const unsubscribe of subscriptions) unsubscribe()
  })

  return { corners, rectangle, $inset, $area }

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
    const [minX, minY] = tl.$position.get()
    const [maxX, maxY] = br.$position.get()
    return [0, 0, width - (maxX - minX), height - (maxY - minY)]
  }

  function bind(corner, { xAxis, yAxis }) {
    return corner.$position.subscribeDirect(([newX, newY]) =>
      moveWithoutRecursion(() => {
        xAxis.move(([_, y]) => [newX, y])
        yAxis.move(([x, _]) => [x, newY])
      })
    )
  }

  function bindRectangle() {
    return rectangle.$position.subscribeDirect(([newX, newY]) =>
      moveWithoutRecursion(() => {
        const [minX, minY] = tl.$position.get()
        const [maxX, maxY] = br.$position.get()
        const width = maxX - minX
        const height = maxY - minY

        tl.move([newX, newY])
        tr.move([newX + width, newY])
        bl.move([newX, newY + height])
        br.move([newX + width, newY + height])
      })
    )
  }

  function moveWithoutRecursion(f) {
    if (movingSiblings) return
    movingSiblings = true

    f()

    movingSiblings = false
  }
}

function getInitialPositions(rectangle) {
  const { x, y, width, height } = rectangle
  const [minX, minY, maxX, maxY] = [x, y, x + width, y + height]
  return /** @type const */ ([
    [minX, minY], [maxX, minY],
    [minX, maxY], [maxX, maxY]]
  )
}

function getBoundedPosition([x, y], [areaX, areaY, areaWidth, areaHeight]) {
  return [clamp(areaX, areaWidth, x), clamp(areaY, areaHeight, y)]
}

function clamp(min, max, input) {
  return Math.min(max, Math.max(min, input))
}
