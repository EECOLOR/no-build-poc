import { ButtonChevronDown, ButtonChevronUp } from '#cms/client/ui/Button.js'
import { renderOnValue } from '#cms/client/machinery/renderOnValue.js'
import { derive } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'
import { css, tags } from '#ui/tags.js'
import { Field } from './Field.js'

const { div, strong } = tags

ObjectField.style = css`
  padding-left: var(--default-padding);
  border-left: 1px solid lightgrey;
`
export function ObjectField({ document, field, $path, id }) {
  return (
    div(
      ObjectField.style,
      Object({ document, field, $path, id })
    )
  )
}

export function Object({ document, field, $path, id }) {
  const [$expanded, setExpanded] = createSignal(true)

  return (
    div(
      ObjectTitle({ id, title: field.title, $expanded, onExpandClick: _ => setExpanded(x => !x) }),
      renderOnValue($expanded,
        _ => ObjectFields({ document, fields: field.fields, $path })
      )
    )
  )
}

ObjectFields.style = css`
  display: flex;
  flex-direction: column;
  gap: calc(var(--default-gap) * 2);
`
export function ObjectFields({ document, fields, $path }) {

  return (
    div(
      ObjectFields.style,
      fields.map(field =>
        Field({ document, field, $path: $path.derive(path => `${path}/${field.name}`) })
      )
    )
  )
}

ObjectTitle.style = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
`
function ObjectTitle({ id, title, $expanded, onExpandClick }) {
  const $Button = $expanded.derive(x => x ? ButtonChevronUp : ButtonChevronDown)

  return strong(
    ObjectTitle.style,
    title,
    derive($Button, Button =>
      Button({ id, onClick: onExpandClick })
    ),
  )
}
