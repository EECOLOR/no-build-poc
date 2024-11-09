import crypto from 'node:crypto'

export function decodeAndVerifyJwt(jwt, publicKeys) {
  const [encodedHeader, encodedBody, encodedSignature] = jwt.split('.')
  const header = decodeJson(encodedHeader)
  const body = decodeJson(encodedBody)
  const signature =decodeRaw(encodedSignature)

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

  const verifier = crypto.createVerify('RSA-SHA256').update(`${encodedHeader}.${encodedBody}`).end()
  const isVerified = verifier.verify(publicKey, signature)
  if (!isVerified)
    return invalid(`Signature is not valid`)

  return { valid: true, header, body }
}

function invalid(hint) {
  return { valid: false, hint }
}

function decodeJson(encoded) {
  const decodedString = decodeRaw(encoded).toString('utf-8')
  try { return decodedString && JSON.parse(decodedString) } catch (e) { }
}
function decodeRaw(encoded) {
  try { return Buffer.from(encoded, 'base64url') } catch (e) { }
}
