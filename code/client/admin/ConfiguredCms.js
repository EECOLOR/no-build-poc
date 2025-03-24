import { Cms } from '#cms/client/Cms.js'
import { Desk } from '#cms/client/desk/Desk.js'
import { routeMap } from '#cms/client/routeMap.js'
import { css } from '#ui/tags.js'
import { createCmsConfig } from './cmsConfig.js'

const apiVersion = '2024-10-25'

// Experiment in overriding styling of elements
Desk.style = [
  Desk.style,
  css`
    background-color: ghostwhite;
  `
]

export function ConfiguredCms({ basePath }) {
  const { deskStructure, paneTypes, documentSchemas, documentView } = createCmsConfig()

  // For development, reconnects when server reloads
  useReloadOnReConnect({ endpoint: `${basePath}${routeMap.api.versioned.connect({ version: apiVersion })}` })

  return Cms({ basePath, deskStructure, paneTypes, documentSchemas, documentView, onError })

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
