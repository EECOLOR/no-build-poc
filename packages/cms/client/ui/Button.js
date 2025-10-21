/** @import { Attributes } from '#ui/tags.js' */

import { arrowDown, arrowUp, chevronLeft, chevronRight, chevronUp, indent, listOl, listUl, outdent, plus, trash } from '#cms/client/ui/icons.js'
import { Signal } from '#ui/signal.js'
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
export const ButtonListUl = createIconButton(listUl)
export const ButtonListOl = createIconButton(listOl)
export const ButtonIndent = createIconButton(indent)
export const ButtonOutdent = createIconButton(outdent)

Button.style = css`
  padding: 0.25rem;
  border: outset 1px lightgray;
`
/**
 * @arg {Attributes<'button'> & { label: any }} props
 * @returns {Tag<'button'>}
 */
export function Button({ label, ...props }) {
  return button({ ...props, type: 'button', css: [Button.style, props.css] }, label)
}

/** @arg {string} icon @arg {{ rotation?: number }} [options] */
function createIconButton(icon, { rotation = 0 } = {}) {
  /** @arg {Attributes<'button'> & { rotation?: number | Signal<number> }} props */
  return function IconButton(props) {
    return withIcon(icon, { rotation: props.rotation || rotation })
      .button({ ...props, type: 'button', css: [Button.style, props.css] })
  }
}
