import config from '#config'
import { createWithPublicKeys } from './oauth2.js'

const authConfig = config.auth.microsoft.web

export const withPublicKeys = createWithPublicKeys(fetchPublicKeys)

async function fetchPublicKeys() {
  const response = await fetch(
    authConfig.auth_provider_keys,
    { headers: { 'Accept': 'application/json' } }
  )

  const result = await response.json()

  return Object.fromEntries( result.keys.map(({ kid, x5c: [x5cCert] }) =>
    [kid, convertX5cToPem(x5cCert)]
  ) )
}

const max64CharsRegex = /.{1,64}/g

function convertX5cToPem(x5cCert) {
  const lines = x5cCert.match(max64CharsRegex).join('\n')
  return (
    `-----BEGIN CERTIFICATE-----\n` +
    `${lines}\n` +
    `-----END CERTIFICATE-----\n`
  )
}
