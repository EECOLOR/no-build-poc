/** @import { Attributes } from '#ui/tags.js' */

import { arrowDown, arrowUp, chevronDown, chevronLeft, chevronRight, chevronUp, plus, trash } from '#cms/client/ui/icons.js'
import { tags, css, Tag } from '#ui/tags.js'
import { withIcon } from './icon.js'

const { button } = tags

export const ButtonAdd = createIconButton(plus)
export const ButtonUp = createIconButton(arrowUp)
export const ButtonDown = createIconButton(arrowDown)
export const ButtonDelete = createIconButton(trash)
export const ButtonChevron = createIconButton(chevronUp)
export const ButtonChevronRight = createIconButton(chevronRight)
export const ButtonChevronLeft = createIconButton(chevronLeft)
export const ButtonClose = createIconButton(plus, { rotation: 45 })

Button.style = css`
  padding: 0.25rem;
  border: outset 1px lightgray;
`
/**
 * @param {Attributes<'button'> & { label: any }} props
 * @returns {Tag<'button'>}
 */
export function Button({ label, ...props }) {
  return button({ type: 'button', ...props }, Button.style, label)
}

function createIconButton(icon, { rotation = 0 } = {}) {
  /** @param {Attributes<'button'> & { rotation?: number }} props */
  return function IconButton(props) {
    return withIcon(icon, { rotation: props.rotation || rotation }).button({ type: 'button', ...props }, Button.style)
  }
}
