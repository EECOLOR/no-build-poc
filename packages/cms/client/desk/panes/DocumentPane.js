import { ButtonChevron, ButtonDelete } from '#cms/client/ui/Button.js'
import { getSchema } from '#cms/client/context.js'
import { connecting, patchDocument, useDocument } from '#cms/client/data.js'
import { DocumentForm } from '#cms/client/form/DocumentForm.js'
import { DocumentHistory } from '#cms/client/history/DocumentHistory.js'
import { renderOnValue } from '#cms/client/machinery/renderOnValue.js'
import { conditional, derive } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'
import { css, tags } from '#ui/tags.js'
import { FlexSectionHorizontal } from '#cms/client/ui/FlexSection.js'
/** @import { DeskStructure } from '../../cmsConfigTypes.ts' */

const { div, h1 } = tags

/**
 * @typedef {{
 *   schemaType: string,
 *   id: string,
 * }} DocumentPaneConfig
 */

/** @type {DeskStructure.PaneRenderer<DocumentPaneConfig>} */
export function renderDocumentPane({ pane, path }) {
  return DocumentPane({ id: pane.id, schemaType: pane.schemaType })
}

DocumentPane.style = css`
  display: grid;
  grid-template-columns: minmax(auto, 35rem) auto;
  grid-template-rows: auto 1fr;
  grid-template-areas:
    'header history'
    'form history'
  ;
  gap: var(--default-gap);

  & > .DocumentHeader {
    grid-area: header;
  }


  & > .DocumentForm {
    grid-area: form;
    min-height: 0;
  }

  & > .DocumentHistory {
    grid-area: history;
    width: 20rem;
  }
`
export function DocumentPane({ id, schemaType }) {
  const $document = useDocument({ id, schemaType })
  const document = { id, schema: getSchema(schemaType), $value: $document }
  const [$showHistory, setShowHistory] = createSignal(false)

  return (
    div({ className: 'DocumentPane', css: DocumentPane.style },
      conditional($document, doc => doc !== connecting, _ => [
        DocumentHeader({ document, $showHistory, onShowHistoryClick: _ => setShowHistory(x => !x) }),
        DocumentForm({ document }),
        renderOnValue($showHistory,
          _ => DocumentHistory({ id, schemaType }),
        )
      ])
    )
  )
}

DocumentHeader.style = css`
  justify-content: space-between;
  align-items: center;
`
function DocumentHeader({ document, $showHistory, onShowHistoryClick }) {
  const $title = document.$value.derive(doc => document.schema.preview(doc).title)

  return (
    FlexSectionHorizontal({ className: 'DocumentHeader', css: DocumentHeader.style },
      h1($title),
      div(
        ButtonDelete({ onClick: handleDeleteClick }),
        ButtonChevron({ onClick: onShowHistoryClick, rotation: $showHistory.derive(x => x ? 270 : 90) })
      )
    )
  )

  function handleDeleteClick() {
    patchDocument({ document, path: '', op: 'remove', fieldType: 'document' })
  }
}
