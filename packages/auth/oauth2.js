/**
 * @param {{
 *   client_id: string
 *   redirect_uri: string
 *   scope: string
 *   auth_uri: string
 * }} authConfig
 */
export function getLoginUrl(authConfig) {
  const searchParams = new URLSearchParams({
    client_id: authConfig.client_id,
    redirect_uri: authConfig.redirect_uri,
    response_type: 'code',
    scope: authConfig.scope,
    // TODO: state - https://developers.google.com/identity/protocols/oauth2/web-server#httprest
    // TODO: state - https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
  })

  return `${authConfig.auth_uri}?${searchParams}`
}

/**
 * @param {{
 *   token_uri: string
 *   client_id: string
 *   redirect_uri: string
 *   client_secret: string
 * }} authConfig
 * @param {URLSearchParams} searchParams
 */
export async function handleLoginCallback(authConfig, searchParams) {
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

/** @typedef {ReturnType<typeof createWithPublicKeys>} WithPublicKeys */

/** @arg {() => Promise<{ [kid: string]: string }>} fetchPublicKeys */
export function createWithPublicKeys(fetchPublicKeys) {
  const cache = {
    lastUpdated: 0,
    publicKeys: {},
  }
  const expiration = 24 * 60 * 60 * 1000

  /** @arg {(publicKeys: { [id: string]: string }, error?: Error) => void} callback */
  return function withPublicKeys(callback) {
    // these things rotate every once in a while, so cache up to 24 hours
    const now = Date.now()
    const cacheExpired = now - cache.lastUpdated > expiration

    if (cacheExpired)
      fetchPublicKeys()
        .then(
          publicKeys => {
            cache.publicKeys = publicKeys
            cache.lastUpdated = now
            callback(publicKeys)
          },
          e => {
            callback(null, e)
          }
        )
    else
      callback(cache.publicKeys)
  }
}
