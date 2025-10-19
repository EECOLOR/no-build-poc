import { array, object, string } from '#validation/schema.js'
import { createWithPublicKeys } from './oauth2.js'

const keysEndpointSchema = object({
  keys: array(
    object({
      kid: string(),
      x5c: array(string()),
    })
  )
})

export const withPublicKeys = createWithPublicKeys(fetchPublicKeys)

async function fetchPublicKeys() {
  const response = await fetch(
    'https://login.microsoftonline.com/01d1e6d7-8e38-4132-8385-a5664abf27ed/discovery/v2.0/keys',
    { headers: { 'Accept': 'application/json' } }
  )
  const result = keysEndpointSchema.parse(await response.json())

  return Object.fromEntries( result.keys.map(({ kid, x5c: [x5cCert] }) =>
    [kid, convertX5cToPem(x5cCert)]
  ) )
}

const max64CharsRegex = /.{1,64}/g

/** @arg {string} x5cCert */
function convertX5cToPem(x5cCert) {
  const lines = x5cCert.match(max64CharsRegex).join('\n')
  return (
    `-----BEGIN CERTIFICATE-----\n` +
    `${lines}\n` +
    `-----END CERTIFICATE-----\n`
  )
}
