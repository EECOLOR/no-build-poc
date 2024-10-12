import { useOnDestroy } from '#ui/dynamic.js'
import { createSignal, Signal } from '#ui/signal.js'
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

/**
 * @param {{ width: number, height: number }} bounds
 * @param {{ x: number, y: number, width: number, height: number }} initialRectangle
 */
export function useDragableRectangle(bounds, initialRectangle) {
  const { width, height } = bounds
  /* TopLeft, TopRight, BottomLeft, BottomRight */
  const [tlPos, trPos, blPos, brPos] = areaToCornerPositions(initialRectangle)
  const [tlOptions, trOptions, blOptions, brOptions, rectangleOptions] = getOptions()
  const corners = [
    useDrag(tlPos, tlOptions), useDrag(trPos, trOptions),
    useDrag(blPos, blOptions), useDrag(brPos, brOptions)
  ]
  const [tl, tr, bl, br] = corners
  const rectangle = useDrag(tlPos, rectangleOptions)

  useBindCornersAndRectangle({ tl, tr, bl, br, rectangle })

  const { $area, $inset } = useDerivedRectanglePositions({ tl, br, width, height })

  return { corners, rectangle, $inset, $area }

  function getOptions() {
    return [
      {
        id: 'tl',
        getBounds() {
           const [x, y] = br.$position.get()
           return [0, 0, x, y]
        }
      },
      {
        id: 'tr',
        getBounds() {
           const [x, y] = bl.$position.get()
           return [x, 0, width, y]
        }
      },
      {
        id: 'bl',
        getBounds() {
           const [x, y] = tr.$position.get()
           return [0, y, x, height - y]
        }
      },
      {
        id: 'br',
        getBounds() {
           const [x, y] = tl.$position.get()
           return [x, y, width - x, height - y]
        }
      },
      {
        id: 'rectangle',
        getBounds() {
          const [minX, minY] = tl.$position.get()
          const [maxX, maxY] = br.$position.get()
          return [0, 0, width - (maxX - minX), height - (maxY - minY)]
        }
      }
    ]
  }
}

/**
 * @param {object} props
 * @param {Signal<{ x: number, y: number, width: number, height: number }>} props.$bounds
 * @param {{ x: number, y: number, width: number, height: number }} props.initialEllipse
 */
export function useDraggableEllipse({ $bounds, initialEllipse }) {

  const [centerPosition, handlePosition] = getPositions()
  const [centerOptions, handleOptions] = getOptions()

  const center = useDrag(centerPosition, centerOptions)
  const handle = useDrag(handlePosition, handleOptions)

  const { $area, $ellipse } = useDerivedEllipsePositions({ center, handle })

  useBindCenterAndHandleAndBounds({ center, handle, $bounds })

  return { center, handle, $ellipse, $area }

  function getOptions() {
    return [
      {
        id: 'center',
        getBounds: () => pipe(
          $bounds.get(), center.$position.get(), handle.$position.get(),
          ({ x, y, width, height }, [centerX, centerY], [handleX, handleY]) => {
            const [xAxis, yAxis] = findEllipseSemiAxes( [handleX - centerX, handleY - centerY])

            return [x + xAxis, y + yAxis, width - (xAxis * 2), height - (yAxis * 2)]
          }
        )
      },
      {
        id: 'handle',
        getBounds: () => pipe(
          $bounds.get(), center.$position.get(),
          (bounds, [centerX, centerY]) => {
            const [maxXAxis, maxYAxis] = [bounds.width / 2, bounds.height / 2]
            const [width, height] = findPointOnEllipse([maxXAxis, maxYAxis])

            return [centerX + 1, centerY + 1, width - 1, height - 1]
          }
        )
      }
    ]
  }

  function getPositions() {
    const { x, y, width, height } = initialEllipse
    const [pointX, pointY] = findPointOnEllipse([width / 2, height / 2])
    const [centerX, centerY] = [x + (width / 2), y + (height / 2)]

    return /** @type const */ ([
      [centerX, centerY],
      [centerX + pointX, centerY + pointY]
    ])
  }
}

function useDerivedEllipsePositions({ center, handle }) {
  const $area = useCombined(center.$position, handle.$position)
    .derive(([[centerX, centerY], [handleX, handleY]]) => {
      const [xAxis, yAxis] = findEllipseSemiAxes([handleX - centerX, handleY - centerY])
      return {
        x: centerX - xAxis,
        y: centerY - yAxis,
        width: xAxis * 2,
        height: yAxis * 2,
      }
    })

  const $ellipse = useCombined(center.$position, handle.$position)
    .derive(([[centerX, centerY], [handleX, handleY]]) => {
      const [xAxis, yAxis] = findEllipseSemiAxes([handleX - centerX, handleY - centerY])
      return { centerX, centerY, xAxis, yAxis }
    })

  return { $area, $ellipse }
}

function pipe(...args) {
  const [...newArgs] = args.slice(0, -1)
  const [f] = args.slice(-1)
  return f(...newArgs)
}

function useBindCornersAndRectangle({ tl, tr, bl, br, rectangle }) {
  const moveWithoutRecursion = createCallWithoutRecursion()

  const subscriptions = [
    bind(tl, { xAxis: bl, yAxis: tr }),
    bind(tr, { xAxis: br, yAxis: tl }),
    bind(bl, { xAxis: tl, yAxis: br }),
    bind(br, { xAxis: tr, yAxis: bl }),

    bind(tl, { xAxis: rectangle, yAxis: rectangle }),
    bindRectangle({ rectangle, tl, tr, bl, br }),
  ]

  useOnDestroy(() => {
    for (const unsubscribe of subscriptions) unsubscribe()
  })

  function bind(corner, { xAxis, yAxis }) {
    return corner.$position.subscribeDirect(([newX, newY]) =>
      moveWithoutRecursion(() => {
        xAxis.move(([_, y]) => [newX, y])
        yAxis.move(([x, _]) => [x, newY])
      })
    )
  }

  function bindRectangle({ tl, tr, bl, br, rectangle }) {
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
}

function useBindCenterAndHandleAndBounds({ center, handle, $bounds }) {
  const moveWithoutRecursion = createCallWithoutRecursion()

  const subscriptions = [
    center.$position.subscribeDirect(([newX, newY], [oldX, oldY]) => {
      moveWithoutRecursion(() => {
        const [handleX, handleY] = handle.$position.get()
        const [xAxis, yAxis] = findEllipseSemiAxes([handleX - oldX, handleY - oldY])
        const [x, y] = findPointOnEllipse([xAxis, yAxis])

        handle.move([newX + x, newY + y])
      })
    }),

    handle.$position.subscribeDirect(([newX, newY], [oldX, oldY]) => {
      moveWithoutRecursion(() => {
        center.move(x => x)
      })
    }),
    $bounds.subscribeDirect(_ => {
      center.move(x => x)
    })
  ]

  useOnDestroy(() => {
    for (const unsubscribe of subscriptions) unsubscribe()
  })
}

function createCallWithoutRecursion() {
  let active = false

  return function callWithoutRecursion(f) {
    if (active) return

    active = true
    f()
    active = false
  }
}

function useDerivedRectanglePositions({ tl, br, width, height }) {
  const $minMax = useCombined(tl.$position, br.$position)

  const $area = $minMax
    .derive(([[minX, minY], [maxX, maxY]]) =>
      ({ x: minX, y: minY, width: maxX - minX, height: maxY - minY })
    )

  const $inset = $minMax.derive(([[minX, minY], [maxX, maxY]]) =>
    ({ top: minY, left: minX, bottom: height - maxY, right: width - maxX })
  )

  return { $area, $inset }
}

function findEllipseSemiAxes([x, y]) {
  const major = Math.max(x, y)
  const minor = Math.min(x, y)
  const ratio = major / minor

  const semiMinorAxis = Math.sqrt((major ** 2 / ratio ** 2) + (minor ** 2))
  const semiMajorAxis = ratio * semiMinorAxis

  return major === x
    ? [semiMajorAxis, semiMinorAxis]
    : [semiMinorAxis, semiMajorAxis]
}

function findPointOnEllipse([horizontalSemiAxis, verticalSemiAxis]) {
  const major = Math.max(horizontalSemiAxis, verticalSemiAxis)
  const minor = Math.min(horizontalSemiAxis, verticalSemiAxis)

  const isHorizontalMajor = major === horizontalSemiAxis

  const majorValue = major * Math.cos(Math.PI / 4)
  const minorValue = minor * Math.sin(Math.PI / 4)

  return isHorizontalMajor
    ? [majorValue, minorValue]
    : [minorValue, majorValue]
}

function areaToCornerPositions(area) {
  const { x, y, width, height } = area
  const [minX, minY, maxX, maxY] = [x, y, x + width, y + height]
  return /** @type const */ ([
    [minX, minY], [maxX, minY],
    [minX, maxY], [maxX, maxY],
  ])
}

function getBoundedPosition([x, y], [areaX, areaY, areaWidth, areaHeight]) {
  return [clamp(areaX, areaX + areaWidth, x), clamp(areaY, areaY + areaHeight, y)]
}

function clamp(min, max, input) {
  return Math.min(max, Math.max(min, input))
}
