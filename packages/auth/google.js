import { createWithPublicKeys } from './oauth2.js'

export const withPublicKeys = createWithPublicKeys(fetchPublicKeys)

async function fetchPublicKeys() {
  const response = await fetch(
    'https://www.googleapis.com/oauth2/v1/certs',
    { headers: { 'Accept': 'application/json' } }
  )
  return response.json()
}

