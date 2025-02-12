import { createSignal } from '#ui/signal.js'
import { scrollable } from '../ui/scrollable.js'
import { css } from '#ui/tags.js'
import { ObjectFields } from './fields/ObjectField.js'

DocumentForm.style = css`
  min-width: 25rem;
  max-width: 35rem;

  & > :last-child {
    margin-top: 1rem;
  }
`
export function DocumentForm({ document }) {
  return (
    scrollable.div({ className: 'DocumentForm', css: DocumentForm.style }, // TODO: use context.documentView
      DocumentFields({ document }),
    )
  )
}

function DocumentFields({ document }) {
  const [$path] = createSignal('')
  return ObjectFields({ document, fields: document.schema.fields, $path })
}
