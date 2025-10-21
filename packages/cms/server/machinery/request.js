import { decodeAndVerifyJwt } from '#auth/jwt.js'
import crypto from 'node:crypto'

/** @import { WithPublicKeys } from '#auth/oauth2.js' */
/** @import { IncomingMessage } from 'node:http' */
/** @import { AuthInfo } from '../../types.ts' */

/**
 * @arg {IncomingMessage} req
 * @arg {(result: unknown, error: Error) => void} callback
 */
export function withRequestJsonBody(req, callback) {
  withRequestBufferBody(req, (buffer, e) => {
    let error = e
    let result = null

    if (!error)
      try { result = JSON.parse(buffer.toString('utf-8')) }
      catch (e) { error = e }

    callback(result, error)
  })
}

/**
 * @arg {IncomingMessage} req
 * @arg {(result: Buffer, error: Error) => void} callback
 */
export function withRequestBufferBody(req, callback) {
  const data = /** @type {Array<Uint8Array>} */ ([])
  req.on('data', chunk => { data.push(chunk) })
  req.on('end', () => {
    let error = null
    let result = null

    try { result = Buffer.concat(data) }
    catch (e) { error = e }

    callback(result, error)
  })
  req.on('error', e => { callback(null, e) })
}

const emptyObject = {}

/** @arg {IncomingMessage} req */
export function getCookies(req) {
  const cookieHeader = req.headers['cookie']
  if (!cookieHeader)
    return emptyObject

  const cookies = Object.create(null) // prevent prototype pollution
  for (const cookieSegment of cookieHeader.split(';')) {
    const [encodedName, encodedValue] = cookieSegment.trim().split('=')
    if (!encodedName)
      continue

    cookies[decodeURIComponent(encodedName)] = decodeURIComponent(encodedValue)
  }

  return cookies
}

/**
 * @arg {IncomingMessage} req
 * @arg {{ [provider: string]: WithPublicKeys }} pubicKeyProviders
 * @arg {(
*    info: AuthInfo,
*    error?: Error,
 * ) => void} callback
 */
export function withAuthInfo(req, pubicKeyProviders, callback) {
  const cookies = getCookies(req)

  const idProvider = cookies['idp']
  const idToken = cookies['idt']

  if (!idToken)
    return notAuthorized('No id token')
  if (!idProvider)
    return notAuthorized('No id provider')

  const withPublicKeys = pubicKeyProviders[idProvider]
  if (!withPublicKeys)
    return notAuthorized(`No public key provider for id provider '${idProvider}'`)

  withPublicKeys((publicKeys, error) => {
    if (error)
      return callback(null, error)

    const { valid, body, hint } = decodeAndVerifyJwt(idToken, publicKeys)
    if (!valid)
      return notAuthorized(`JWT not valid (${hint})`)

    const id = crypto.createHash('md5').update(body.email).digest('hex')
    return callback({ authenticated: true, idProvider, user: { email: body.email, name: body.name, id } })
  })

  /** @arg {string} hint */
  function notAuthorized(hint) {
    return callback({ authenticated: false, hint })
  }
}
