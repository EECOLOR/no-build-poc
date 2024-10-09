import { useOnDestroy } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'

export function useDrag(initialPosition, getArea) {
  const [$position, setPosition] = createSignal(initialPosition)
  const $translate = $position.derive(({ x, y }) => ({ x: x - initialPosition.x, y: y - initialPosition.y }))

  let state = {}

  useOnDestroy(removeListeners)

  return { handleMouseDown, $translate, $position, move }

  function move(f) {
    setPosition(position => getBoundedPosition(f(position)))
  }

  function handleMouseDown(e) {
    const parent = e.currentTarget.parentElement.getBoundingClientRect()
    const offset = { x: e.offsetX, y: e.offsetY }
    state = { offset, parent }

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
    const { offset, parent } = state
    const localMouseX = e.clientX - parent.x
    const localMouseY = e.clientY - parent.y

    const position = {
      x: localMouseX - offset.x,
      y: localMouseY - offset.y,
    }

    setPosition(getBoundedPosition(position))
  }

  function getBoundedPosition({ x, y, ...other }) {
    const area = getArea()
    return {
      ...other,
      x: clamp(area.x, area.width, x),
      y: clamp(area.y, area.height, y),
    }
  }

  function handleMouseUp() {
    state = {}
    removeListeners()
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
