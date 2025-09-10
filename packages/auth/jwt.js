import crypto from 'node:crypto'

/**
 * @arg {string} jwt
 * @arg {{ [id: string]: string}} publicKeys
 * @returns {{ valid: boolean, header?: any, body?: any, hint?: string }}
 */
export function decodeAndVerifyJwt(jwt, publicKeys) {
  const [encodedHeader, encodedBody, encodedSignature] = jwt.split('.')
  const header = decodeJson(encodedHeader)
  const body = decodeJson(encodedBody)
  const signature = decodeRaw(encodedSignature)

  if (!header)
    return invalid(`Could not decode header`)
  if (!body)
    return invalid(`Could not decode body`)
  if (!signature)
    return invalid(`Could not decode signature`)

  const { alg, typ, kid } = header
  if (typ !== 'JWT')
    return invalid(`Unknown type '${typ}', if you need to use this type please add support for it`)
  if (alg !== 'RS256')
    return invalid(`Unknown algorith '${alg}', if you need to use this algorith please add suppoer for it`)
  if (!kid)
    return invalid(`No 'kid' present, this is used to determine the public key. If you need support for jwt without 'kid' please add it`)

  const publicKey = publicKeys[kid]
  if (!publicKey)
    return invalid(`No public key found for 'kid' with value '${kid}'`)

  const isVerified = crypto
    .createVerify('RSA-SHA256')
    .update(`${encodedHeader}.${encodedBody}`)
    .verify(publicKey, signature)

  if (!isVerified)
    return invalid(`Signature is not valid`)

  return { valid: true, header, body }
}

/**
 * @arg {string} kid
 * @arg {any} body
 * @arg {string} privateKey
 */
export function createJwt(kid, body, privateKey) {
  const encodedHeader = encodeJson({ alg: "RS256", typ: "JWT", kid })
  const encodedBody = encodeJson(body)
  const unsignedToken = `${encodedHeader}.${encodedBody}`

  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsignedToken)
    .sign(privateKey)
    .toString('base64url')

  return `${unsignedToken}.${signature}`
}

/** @arg {string} hint */
function invalid(hint) {
  return { valid: false, hint }
}

/** @arg {any} json */
function encodeJson(json) {
  const jsonString = JSON.stringify(json)
  return encodeRaw(jsonString)
}

/** @arg {string} value */
function encodeRaw(value) {
  return Buffer.from(value).toString('base64url')
}

/** @arg {string} encoded */
function decodeJson(encoded) {
  const decodedString = decodeRaw(encoded).toString('utf-8')
  try { return decodedString && JSON.parse(decodedString) } catch (e) { }
}
/** @arg {string} encoded */
function decodeRaw(encoded) {
  try { return Buffer.from(encoded, 'base64url') } catch (e) { }
}
