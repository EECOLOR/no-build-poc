import config from '#config'

const authConfig = config.google.web

const cache = {
  lastUpdated: 0,
  publicKeys: {},
}
const expiration = 24 * 60 * 60 * 1000

/** @param {(publicKeys: { [id: string]: string }, error?: Error) => void} */
export function withPublicKeys(callback) {
  // these things rotate every once in a while, so cache up to 24 hours
  const now = Date.now()
  const cacheExpired = now - cache.lastUpdated > expiration

  if (cacheExpired)
    fetchPublicKeys()
      .catch(e => { callback(null, e) })
      .then(publicKeys => {
        cache.publicKeys = publicKeys
        cache.lastUpdated = now
        callback(publicKeys)
      })
  else
    callback(cache.publicKeys)
}

export function getLoginUrl() {
  const searchParams = new URLSearchParams({
    client_id: authConfig.client_id,
    redirect_uri: authConfig.redirect_uri,
    response_type: 'code',
    scope: authConfig.scope,
    // TODO: state - https://developers.google.com/identity/protocols/oauth2/web-server#httprest
  })

  return `${authConfig.auth_uri}?${searchParams}`
}

/** @param {URLSearchParams} searchParams */
export async function handleLoginCallback(searchParams) {
  const error = searchParams.get('error')
  if (error)
    throw new Error(`Login failed: ${error}`)

  const response = await fetch(authConfig.token_uri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      code: searchParams.get('code'),
      client_id: authConfig.client_id,
      client_secret: authConfig.client_secret,
      redirect_uri: authConfig.redirect_uri,
      grant_type: 'authorization_code',
    })
  })

  const text = await response.text()
  let json
  try {
    json = JSON.parse(text)
  } catch (e) {
    throw new Error(`Failed to parse JSON:\n${text}`)
  }

  return json.id_token
}

async function fetchPublicKeys() {
  const response = await fetch(
    authConfig.auth_provider_x509_cert_url,
    { headers: { 'Accept': 'application/json' } }
  )

  return response.json()
}

