import { ButtonChevronLeft, ButtonChevronRight, ButtonDelete } from '#cms/client/buildingBlocks.js'
import { getSchema } from '#cms/client/context.js'
import { connecting, patchDocument, useDocument } from '#cms/client/data.js'
import { DocumentForm } from '#cms/client/form/DocumentForm.js'
import { DocumentHistory } from '#cms/client/history/DocumentHistory.js'
import { renderOnValue } from '#cms/client/machinery/renderOnValue.js'
import { conditional, derive } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'
import { css, tags } from '#ui/tags.js'

const { div, h1 } = tags

DocumentPane.style = css`& {
  display: flex;
  flex-direction: column;
  gap: var(--default-gap);
  padding: var(--default-padding);
  max-width: fit-content;
}`
export function DocumentPane({ id, schemaType }) {
  const $document = useDocument({ id, schemaType })
  const document = { id, schema: getSchema(schemaType), $value: $document }
  const [$showHistory, setShowHistory] = createSignal(false)

  return (
    div(
      DocumentPane.style,
      conditional($document, doc => doc !== connecting, _ => [
        DocumentHeader({ document, $showHistory, onShowHistoryClick: _ => setShowHistory(x => !x) }),
        DocumentBody({ document, $showHistory, id, schemaType }),
      ])
    )
  )
}

DocumentBody.style = css`& {
  display: flex;
  min-height: 0;
  gap: calc(var(--default-gap) * 2);

  & > .DocumentHistory {
    width: 20rem;
  }
}`
function DocumentBody({ document, $showHistory, id, schemaType }) {
  return (
    div({ className: 'DocumentBody' },
      DocumentBody.style,
      DocumentForm({ document }),
      renderOnValue($showHistory,
        _ => DocumentHistory({ id, schemaType }),
      )
    )
  )
}

DocumentHeader.style = css`& {
  display: flex;
  justify-content: space-between;
  align-items: center;

  & > div {
    display: flex;
  }
}`
function DocumentHeader({ document, $showHistory, onShowHistoryClick }) {
  const $title = document.$value.derive(doc => document.schema.preview(doc).title)
  const $Button = $showHistory.derive(x => x ? ButtonChevronLeft : ButtonChevronRight)

  return (
    div(
      DocumentHeader.style,
      h1($title),
      div(
        ButtonDelete({ onClick: handleDeleteClick }),
        derive($Button, Button =>
          Button({ onClick: onShowHistoryClick })
        )
      )
    )
  )

  function handleDeleteClick() {
    patchDocument({ document, path: '', op: 'remove', fieldType: 'document' })
  }
}
