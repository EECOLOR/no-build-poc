import { tags } from '#ui/tags.js'
import { setContext } from './context.js'
import { Desk } from './desk/Desk.js'

const { div } = tags

const apiVersion = '2024-09-07'

export function Cms({ basePath, deskStructure, documentSchemas, documentView, apiPath }) {

  if (typeof window === 'undefined')
    return div('Loading...')

  const clientId = window.crypto.randomUUID()
  setContext({ documentSchemas, documentView, basePath, clientId, apiPath: `${apiPath}/${apiVersion}` })

  return Desk({ deskStructure })
}
