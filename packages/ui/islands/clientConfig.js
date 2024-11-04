const configLib = '#config'
export const clientConfigId = 'client-config'

const getClientConfig = typeof window === 'undefined' ? getConfigAtServer : getConfigAtClient

export const clientConfig = await getClientConfig()

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
