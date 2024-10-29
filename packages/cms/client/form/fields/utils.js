export function getAtPath(o, path) {
  const keys = path.split('/').filter(Boolean)
  return keys.reduce((result, key) => result && result[key], o)
}
