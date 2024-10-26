import { css, tags } from '#ui/tags.js'
import { setContext } from './context.js'
import { Desk } from './desk/Desk.js'
import { createMessageBroker } from './machinery/messageBroker.js'

const { div } = tags

const apiVersion = '2024-09-07'

export function Cms({ basePath, deskStructure, documentSchemas, documentView, apiPath, onError }) {
  return typeof window === 'undefined'
    ? CmsLoader()
    : CmsWithContext({ basePath, deskStructure, documentSchemas, documentView, apiPath, onError })
}

function CmsLoader() {
  return div('Loading...')
}

CmsWithContext.style = css`& {
  --default-padding: 0.5rem;
}`
function CmsWithContext({ basePath, deskStructure, documentSchemas, documentView, apiPath, onError }) {
  const apiPathWithVersion = `${apiPath}/${apiVersion}`

  setContext({
    documentSchemas,
    documentView,
    basePath,
    clientId: window.crypto.randomUUID(),
    apiPath: apiPathWithVersion,
    events: createMessageBroker({ apiPath: apiPathWithVersion, onError }),
  })

  return (
    div(
      CmsWithContext.style,
      Desk({ deskStructure }),
    )
  )
}
