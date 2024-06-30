import { raw, tags } from '/machinery/tags.js'
const { script } = tags

const clientConfigId = 'client-config'
const configLib = '#config'

const getClientConfig = typeof window === 'undefined' ? getConfigAtServer : getConfigAtClient

export const clientConfig = await getClientConfig()

export function ClientConfig() {
  return script({ type: 'config', id: clientConfigId }, raw(JSON.stringify(clientConfig))) // use safe stringify
}

/** @returns {ReturnType<typeof getConfigAtServer>} */
async function getConfigAtClient() {
  const configElement = window.document.getElementById(clientConfigId)
  if (!configElement) throw new Error('Could not find config element, did you render ClientConfig?')

  return JSON.parse(configElement.innerText)
}

async function getConfigAtServer() {
  /** @type {import('#config')} */
  const config = await import(configLib)
  return config.default.client
}
