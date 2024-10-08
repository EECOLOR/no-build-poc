import { useOnDestroy } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'

export function useDrag({ onDragEnd }) {
  const [$translate, setTranslate] = createSignal({ x: 0, y: 0 })

  let state = {}

  useOnDestroy(removeListeners)

  return { onMouseDown, $translate }

  function onMouseDown(e) {
    const translate = $translate.get()
    const element = e.currentTarget.getBoundingClientRect()
    const parent = e.currentTarget.parentElement.getBoundingClientRect()

    const offset = { x: e.offsetX, y: e.offsetY }
    const area = parent
    const start = {
      x: (element.x - area.x) - translate.x,
      y: (element.y - area.y) - translate.y,
    }
    const minX = -start.x
    const minY = -start.y
    const bounds = {
      minX, maxX: minX + area.width - element.width,
      minY, maxY: minY + area.height - element.height
    }
    state = { offset, area, start, bounds, element }

    console.log(state)
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
    const { start, area, offset, bounds } = state
    const localMouseX = e.clientX - area.x
    const localMouseY = e.clientY - area.y

    const translateX = clamp(bounds.minX, bounds.maxX, localMouseX - start.x - offset.x)
    const translateY = clamp(bounds.minY, bounds.maxY, localMouseY - start.y - offset.y)

    setTranslate({ x: translateX, y: translateY })
  }

  function handleMouseUp() {
    const translate = $translate.get()
    const { start, area, element } = state

    state = {}
    removeListeners()

    onDragEnd(calculateActualPosition({ translate, start, area, element }))
  }
}

function calculateActualPosition({ translate, start, area, element }) {
  const position = {
    x: translate.x + start.x,
    y: translate.y + start.y,
  }
  const draggableArea = {
    width: area.width - element.width,
    height: area.height - element.height,
  }

  return {
    x: (position.x / draggableArea.width) * area.width,
    y: (position.y / draggableArea.height) * area.height,
  }
}

function clamp(min, max, input) {
  return Math.min(max, Math.max(min, input))
}
