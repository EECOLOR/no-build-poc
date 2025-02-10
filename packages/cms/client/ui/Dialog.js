import { controller } from '#cms/client/machinery/useController.js'
import { css, tags } from '#ui/tags.js'

const { dialog } = tags

Dialog.controller = controller(
  'dialog',
  ref => ({
    close() {
      ref.current.close()
    },
    open() {
      ref.current.showModal()
    }
  })
)
Dialog.style = css`
  &[open] {
    padding: var(--default-padding);
    margin: auto;
    box-shadow: 4px 4px 8px rgb(0 0 0 / 50%);
    height: 100%;
  }

  &::backdrop {
    backdrop-filter: blur(0.25rem);
  }
`
/**
 * @param {{ controller: ReturnType<typeof Dialog.controller> }} props
 * @param {any[]} children
 */
export function Dialog({ controller }, ...children) {

  return (
    dialog({ ref: controller.ref },
      Dialog.style,
      ...children,
    )
  )
}
