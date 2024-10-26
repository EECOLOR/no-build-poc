import { Cms } from '#cms/client/Cms.js'
import { Desk } from '#cms/client/desk/Desk.js'
import { css } from '#ui/tags.js'
import { createCmsConfig } from './cmsConfig.js'

const apiVersion = '2024-10-25'

// Experiment in overriding styling of elements
Desk.style = [
  Desk.style,
  css`& {
    background-color: ghostwhite;
  }`
]

export function ConfiguredCms({ basePath, apiPath }) {
  const { deskStructure, documentSchemas, documentView } = createCmsConfig()

  // For development, reconnects when server reloads
  useReloadOnReConnect({ endpoint: `${apiPath}/${apiVersion}/connect` })

  return Cms({ basePath, deskStructure, documentSchemas, documentView, apiPath, onError })

  function onError(e) {
    console.error(e)
  }
}

function useReloadOnReConnect({ endpoint }) {
  if (typeof window === 'undefined') return

  let connected = false

  const eventSource = new EventSource(endpoint)
  window.addEventListener('beforeunload', _ => eventSource.close())
  eventSource.addEventListener('open', _ => {
    connected = true
  })
  eventSource.addEventListener('error', _ => {
    if (!connected) return
    console.log('Connection lost, reloading window')
    window.location.reload()
  })
}
