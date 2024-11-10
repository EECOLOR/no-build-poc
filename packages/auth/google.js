import config from '#config'
import { createWithPublicKeys } from './oauth2.js'

const authConfig = config.auth.google.web

export const withPublicKeys = createWithPublicKeys(fetchPublicKeys)

async function fetchPublicKeys() {
  const response = await fetch(
    authConfig.auth_provider_x509_cert_url,
    { headers: { 'Accept': 'application/json' } }
  )

  return response.json()
}

