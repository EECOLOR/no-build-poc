import { createSignal } from '#ui/signal.js'
import { css } from '#ui/tags.js'
import { scrollable } from '../buildingBlocks.js'
import { ObjectFields } from './fields/ObjectField.js'

DocumentForm.style = css`& {
  /* display: flex;
  flex-direction: column; */
  min-width: 25rem;
  max-width: 35rem;

  & > :last-child {
    margin-top: 1rem;
  }
}`
export function DocumentForm({ document }) {
  return (
    scrollable.div(// TODO: use context.documentView
      DocumentForm.style,
      DocumentFields({ document }),
    )
  )
}

function DocumentFields({ document }) {
  const [$path] = createSignal('')
  return ObjectFields({ document, fields: document.schema.fields, $path })
}
