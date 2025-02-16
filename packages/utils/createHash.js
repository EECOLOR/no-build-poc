const fnv1aOffset = 2166136261
const fnv1aPrime = 16777619

export function createHash(str) {
  return fnv1aHash(str)
}

function fnv1aHash(str) {
  let hash = fnv1aOffset >>> 0
  for (let i = 0; i < str.length; i++) {
    hash = hash ^ (str.charCodeAt(i) >>> 0)
    hash = (hash * fnv1aPrime) >>> 0
  }
  return hash.toString(16)
}
