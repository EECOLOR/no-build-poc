import { useDrag, useElementSize } from '#cms/client/machinery/elementHooks.js'
import { useCombined, useSubscriptions } from '#cms/client/machinery/signalHooks.js'
import { conditional, derive, useOnDestroy } from '#ui/dynamic.js'
import { Signal } from '#ui/signal.js'
import { css, tags } from '#ui/tags.js'

const { div, img } = tags

const connecting = Symbol('connecting')

ImageCropAndHotspot.style = css`& {
  --handle-size: 1rem;

  display: grid;
  grid-template-columns: 1fr;
  padding: calc(var(--handle-size) / 2);
  border: 1px solid lightgray;

  & > * {
    grid-row-start: 1;
    grid-column-start: 1;

    width: 100%;
    height: 100%;

    position: relative;
  }
}`
export function ImageCropAndHotspot({ src, $metadata, onCropChange, onHotspotChange }) {
  const { ref, $size } = useElementSize()

  const $displaySize = $size.derive(x => x?.width && x?.height ? x : connecting)

  const { $crop, $hotspot, resizeToActualSize } = useDerivedLocalValues({ $metadata, $displaySize })

  return (
    div(
      ImageCropAndHotspot.style,
      img({ ref, src }),
      conditional($displaySize, displaySize => displaySize !== connecting, _ =>
        HotspotAndCropOverlay({
          src,
          $displaySize,
          $crop,
          $hotspot,
          onCropChange(crop) {
            onCropChange(resizeToActualSize(crop))
          },
          onHotspotChange(hotspot) {
            onHotspotChange(resizeToActualSize(hotspot))
          },
        })
      )
    )
  )
}

function useDerivedLocalValues({ $metadata, $displaySize }) {
  const $ratio = useCombined($metadata, $displaySize)
    .derive(([metadata, displaySize]) => {
      if (displaySize === connecting) return connecting

      return {
        width: metadata.width / displaySize.width,
        height: metadata.height / displaySize.height,
      }
    })

  const $crop = $ratio
    .derive(ratio => {
      if (ratio === connecting) return connecting
      const metadata = $metadata.get()
      const displaySize = $displaySize.get()

      return metadata.crop ? resizeToScreen(metadata.crop, ratio) : addPosition(displaySize)
    })

  const $hotspot = $crop
    .derive(crop => {
      if (crop === connecting) return connecting
      const metadata = $metadata.get()
      const ratio = $ratio.get()

      return metadata.hotspot ? resizeToScreen(metadata.hotspot, ratio) : crop
    })

  return { $crop, $hotspot, resizeToActualSize }

  function addPosition(size) {
    return { x: 0, y: 0, ...size }
  }

  function resizeToActualSize({ x, y, width, height }) {
    const ratio = $ratio.get()
    if (ratio === connecting)
      throw new Error(`Can not resize back to actual size when $ratio is connecting`)

    return {
      x: Math.round(x * ratio.width),
      y: Math.round(y * ratio.height),
      width: Math.round(width * ratio.width),
      height: Math.round(height * ratio.height),
    }
  }

  function resizeToScreen({ x, y, width, height }, ratio) {
    const result = {
      x: Math.round(x / ratio.width),
      y: Math.round(y / ratio.height),
      width: Math.round(width / ratio.width),
      height: Math.round(height / ratio.height),
    }
    return result
  }
}

function HotspotAndCropOverlay({ src, $crop, $hotspot, $displaySize, onCropChange, onHotspotChange }) {
  const { corners, rectangle, $inset, $area: $cropArea } =
    useDragableRectangle({ $bounds: $displaySize, $initialRectangle: $crop })
  const { center, handle, $ellipse, $area: $hotspotArea } =
    useDraggableEllipse({ $bounds: $cropArea, $initialEllipse: $hotspot })

  useSubscriptions(
    $cropArea.subscribe(onCropChange),
    $hotspotArea.subscribe(onHotspotChange),
   )

  return [
    Shadow(),
    CropImage({ src, $inset }),
    Shadow(),
    HotspotImage({ src, $ellipse }),
    CropRectangle({ corners, rectangle, $inset }),
    HotspotEllipse({ center, handle, $ellipse }),
  ]
}

function HotspotImage({ src, $ellipse }) {
  const $clipPath = ellipseAsClipPath($ellipse)

  return img({ src: src, style: { clipPath: $clipPath } })
}

function ellipseAsClipPath($ellipse) {
  return $ellipse.derive(({ xAxis, yAxis, centerX, centerY }) =>
    `ellipse(${xAxis}px ${yAxis}px at ${centerX}px ${centerY}px)`
  )
}

HotspotEllipse.style = css`& {
  pointer-events: none;
  position: relative;

  & > * {
    pointer-events: auto;
    position: absolute;
  }

  & > * { cursor: move; }
  & > .handle { cursor: nwse-resize; }
}`
function HotspotEllipse({ center, handle, $ellipse }) {
  return (
    div(
      HotspotEllipse.style,
      HotspotArea({ onMouseDown: center.handleMouseDown, $ellipse }),
      Handle({ handle, type: 'circle' })
    )
  )
}

HotspotArea.style = css`& {
  overflow: visible;
  width: 0;
  height: 0;

  &::after {
    content: '';
    display: block;
    width: var(--width);
    height: var(--height);
    transform: translate(-50%, -50%);
    clip-path: var(--clipPath);
  }
}`
function HotspotArea({ onMouseDown, $ellipse }) {
  const $localEllipse = $ellipse.derive(({ xAxis, yAxis }) =>
    ({ centerX: xAxis, centerY: yAxis, xAxis, yAxis })
  )
  const $clipPath = ellipseAsClipPath($localEllipse)

  const style = {
    top: $ellipse.derive(x => x.centerY),
    left: $ellipse.derive(x => x.centerX),
    '--width': $ellipse.derive(x => `${x.xAxis * 2}px`),
    '--height': $ellipse.derive(x => `${x.yAxis * 2}px`),
    '--clipPath': $clipPath,
  }

  return div({ className: 'HotspotArea', onMouseDown, style }, HotspotArea.style)
}

function CropImage({ src, $inset }) {
  const $clipPath = $inset.derive(x => `inset(${x.top}px ${x.right}px ${x.bottom}px ${x.left}px)`)

  return img({ src: src, style: { clipPath: $clipPath } })
}

function Shadow() {
  return div(css`& { background-color: rgb(0 0 0 / 40%); pointer-events: none; }`)
}

CropRectangle.style = css`& {
  position: relative;
  pointer-events: none;

  & > * {
    position: absolute;
    pointer-events: auto;
  }

  & > * { cursor: move; }
  & > .tl, & > .br { cursor: nwse-resize; }
  & > .tr, & > .bl { cursor: nesw-resize; }
}`
function CropRectangle({ corners, rectangle, $inset }) {
  return (
    div(
      CropRectangle.style,
      CropArea({ onMouseDown: rectangle.handleMouseDown, $inset }),
      corners.map(handle => Handle({ handle })),
    )
  )
}

function CropArea({ onMouseDown, $inset }) {
  const style = {
    top: $inset.derive(x => x.top),
    left: $inset.derive(x => x.left),
    bottom: $inset.derive(x => x.bottom),
    right: $inset.derive(x => x.right),
  }

  return div({ className: 'CropArea', onMouseDown, style })
}

Handle.style = css`& {
  will-change: transform;

  width: 0;
  height: 0;
  overflow: visible;

  &::after {
    content: '';
    display: block;
    width: var(--handle-size);
    height: var(--handle-size);
    transform: translate(-50%, -50%);
    background-color: turquoise;
    border-radius: var(--borderRadius);
  }
}`
/** @param {{ handle: any, type?: 'square' | 'circle' }} props */
function Handle({ handle, type = 'square' }) {
  const { id, handleMouseDown, $translate, $position } = handle
  const [handleX, handleY] = $position.get()
  const $transformStyle = $translate.derive(([x, y]) => `translate(${x}px,${y}px)`)
  return (
    div(
      {
        onMouseDown: handleMouseDown,
        className: id,
        style: {
          transform: $transformStyle,
          left: handleX,
          top: handleY,
          '--borderRadius': type === 'circle' ? '50%' : '0',
        }
      },
      Handle.style
    )
  )
}

/**
 * @param {object} props
 * @param {Signal<{ width: number, height: number }>} props.$bounds
 * @param {Signal<{ x: number, y: number, width: number, height: number }>} props.$initialRectangle
 */
 function useDragableRectangle({ $bounds, $initialRectangle }) {
  /* TopLeft, TopRight, BottomLeft, BottomRight */
  const [tlPos, trPos, blPos, brPos] = areaToCornerPositions($initialRectangle.get())
  const [tlOptions, trOptions, blOptions, brOptions, rectangleOptions] = getOptions()
  const corners = [
    useDrag(tlPos, tlOptions), useDrag(trPos, trOptions),
    useDrag(blPos, blOptions), useDrag(brPos, brOptions)
  ]
  const [tl, tr, bl, br] = corners
  const rectangle = useDrag(tlPos, rectangleOptions)

  useRectangle({ tl, tr, bl, br, rectangle, $bounds, $initialRectangle })

  const { $area, $inset } = useDerivedRectanglePositions({ tl, br, $bounds })

  return { corners, rectangle, $inset, $area }

  function getOptions() {
    return [
      {
        id: 'tl',
        getBounds() {
           const [x, y] = br.$position.get()
           return [0, 0, x - 10, y - 10]
        }
      },
      {
        id: 'tr',
        getBounds() {
           const [x, y] = bl.$position.get()
           const { width } = $bounds.get()
           return [x + 10, 0, width - 10, y - 10]
        }
      },
      {
        id: 'bl',
        getBounds() {
           const [x, y] = tr.$position.get()
           const { height } = $bounds.get()
           return [0, y + 10, x - 10, height - y - 10]
        }
      },
      {
        id: 'br',
        getBounds() {
           const [x, y] = tl.$position.get()
           const { width, height } = $bounds.get()
           return [x + 10, y + 10, width - x - 10, height - y - 10]
        }
      },
      {
        id: 'rectangle',
        getBounds() {
          const [minX, minY] = tl.$position.get()
          const [maxX, maxY] = br.$position.get()
          const { width, height } = $bounds.get()
          return [0, 0, width - (maxX - minX), height - (maxY - minY)]
        }
      }
    ]
  }
}

/**
 * @param {object} props
 * @param {Signal<{ x: number, y: number, width: number, height: number }>} props.$bounds
 * @param {Signal<{ x: number, y: number, width: number, height: number }>} props.$initialEllipse
 */
function useDraggableEllipse({ $bounds, $initialEllipse }) {

  const [centerPosition, handlePosition] = getEllipsePositions($initialEllipse.get())
  const [centerOptions, handleOptions] = getOptions()

  const center = useDrag(centerPosition, centerOptions)
  const handle = useDrag(handlePosition, handleOptions)

  const { $area, $ellipse } = useDerivedEllipsePositions({ center, handle, $bounds })

  useBindEllipse({ center, handle, $bounds, $initialEllipse })

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
}

function getEllipsePositions(initialEllipse) {
  const { x, y, width, height } = initialEllipse
  const [pointX, pointY] = findPointOnEllipse([width / 2, height / 2])
  const [centerX, centerY] = [x + (width / 2), y + (height / 2)]

  return /** @type const */ ([
    [centerX, centerY],
    [centerX + pointX, centerY + pointY]
  ])
}

function useDerivedEllipsePositions({ center, handle, $bounds }) {
  const $area = useCombined($bounds, center.$position, handle.$position)
    .derive(([bounds, [centerX, centerY], [handleX, handleY]]) => {
      const [xAxis, yAxis] = findEllipseSemiAxes([handleX - centerX, handleY - centerY])
      return {
        x: Math.max(bounds.x, centerX - xAxis),
        y: Math.max(bounds.y, centerY - yAxis),
        width: Math.min(bounds.width, xAxis * 2),
        height: Math.min(bounds.height, yAxis * 2),
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

function useRectangle({ tl, tr, bl, br, rectangle, $bounds, $initialRectangle }) {
  const moveWithoutRecursion = createCallWithoutRecursion()

  const subscriptions = [
    bind(tl, { xAxis: bl, yAxis: tr }),
    bind(tr, { xAxis: br, yAxis: tl }),
    bind(bl, { xAxis: tl, yAxis: br }),
    bind(br, { xAxis: tr, yAxis: bl }),

    bind(tl, { xAxis: rectangle, yAxis: rectangle }),
    bindRectangle({ rectangle, tl, tr, bl, br }),

    $bounds.subscribeDirect(_ => rectangle.move(x => x)),
    $initialRectangle.subscribeDirect(initialRectangle => {
      moveWithoutRecursion(() => {
        const [tlPos, trPos, blPos, brPos] = areaToCornerPositions(initialRectangle)
        tl.move(tlPos)
        tr.move(trPos)
        bl.move(blPos)
        br.move(brPos)

        rectangle.move(tlPos)
      })
    }),
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

function useBindEllipse({ center, handle, $bounds, $initialEllipse }) {
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
    $bounds.subscribeDirect(_ => center.move(x => x)),
    $initialEllipse.subscribeDirect(initialEllipse => {
      moveWithoutRecursion(() => {
        const [centerPosition, handlePosition] = getEllipsePositions(initialEllipse)
        center.move(centerPosition)
        handle.move(handlePosition)
      })
    }),
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

function useDerivedRectanglePositions({ tl, br, $bounds }) {
  const $minMax = useCombined(tl.$position, br.$position)

  const $area = $minMax
    .derive(([[minX, minY], [maxX, maxY]]) =>
      ({ x: minX, y: minY, width: maxX - minX, height: maxY - minY })
    )

  const $inset = $minMax
    .derive(([[minX, minY], [maxX, maxY]]) => {
      const { width, height } = $bounds.get()
      return { top: minY, left: minX, bottom: height - maxY, right: width - maxX }
    })

  return { $area, $inset }
}

function findEllipseSemiAxes([x, y]) {
  const major = Math.max(x, y)
  const minor = Math.min(x, y)
  if (!major || !minor) return [0, 0]
  const ratio = major / minor

  const semiMinorAxis = Math.round(Math.sqrt((major ** 2 / ratio ** 2) + (minor ** 2)))
  const semiMajorAxis = Math.round(ratio * semiMinorAxis)

  return major === x
    ? [semiMajorAxis, semiMinorAxis]
    : [semiMinorAxis, semiMajorAxis]
}

function findPointOnEllipse([horizontalSemiAxis, verticalSemiAxis]) {
  const major = Math.max(horizontalSemiAxis, verticalSemiAxis)
  const minor = Math.min(horizontalSemiAxis, verticalSemiAxis)

  const isHorizontalMajor = major === horizontalSemiAxis

  const majorValue = Math.round(major * Math.cos(Math.PI / 4))
  const minorValue = Math.round(minor * Math.sin(Math.PI / 4))

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
