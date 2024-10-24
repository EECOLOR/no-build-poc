import { tags } from '#ui/tags.js'
import { setContext } from './context.js'
import { Desk } from './desk/Desk.js'
import { createMessageBroker } from './machinery/useEventSourceAsSignal.js'

const { div } = tags

const apiVersion = '2024-09-07'

export function Cms({ basePath, deskStructure, documentSchemas, documentView, apiPath, onError }) {

  if (typeof window === 'undefined')
    return div('Loading...')

  const clientId = window.crypto.randomUUID()
  let events
  setContext({
    documentSchemas,
    documentView,
    basePath,
    clientId,
    apiPath: `${apiPath}/${apiVersion}`,
    get events() {
      if (!events) events = createMessageBroker({ onError })
      return events
    }
  })

  return Desk({ deskStructure })
}
