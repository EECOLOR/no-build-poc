import { tags } from '#ui/tags.js'
import { setContext } from './context.js'
import { Desk } from './desk/Desk.js'
import { createMessageBroker } from './machinery/messageBroker.js'

const { div } = tags

const apiVersion = '2024-09-07'

export function Cms({ basePath, deskStructure, documentSchemas, documentView, apiPath, onError }) {

  if (typeof window === 'undefined')
    return div('Loading...')

  const clientId = window.crypto.randomUUID()
  const apiPathWithVersion = `${apiPath}/${apiVersion}`
  let events
  setContext({
    documentSchemas,
    documentView,
    basePath,
    clientId,
    apiPath: apiPathWithVersion,
    events: createMessageBroker({ apiPath: apiPathWithVersion, onError }),
  })

  return Desk({ deskStructure })
}
