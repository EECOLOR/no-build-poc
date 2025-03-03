export function getAt(o, path) {
  return getKeys(path).reduce((result, key) => result && result[key], o)
}

export function setAt(o, path, value, { insertIfArray = false } = {}) {
  const keys = getKeys(path)
  let target = o
  for (const [i, key] of keys.entries()) {
    const isLast = i === keys.length - 1
    if (isLast) {
      if (insertIfArray && isNumber(key)) target.splice(key, 0, value)
      else target[key] = value // TODO: this is a security vulnerability
      return
    }

    if (target[key]) {
      target = target[key]
      continue
    }

    const nextKey = keys[i + 1]
    target = target[key] = isNumber(nextKey) ? [] : {}
  }
}

export function deleteAt(o, path) {
  const keys = getKeys(path)
  return keys.reduce(
    (result, key, i) => {
      const isLast = i === keys.length - 1

      if (isLast && result) {
        const value = result[key]
        if (Array.isArray(result)) result.splice(key, 1)
        else delete result[key]
        return value
      }

      return result && result[key]
    },
    o
  )
}

function isNumber(x) {
  return !Number.isNaN(Number(x))
}

function getKeys(path) {
  return path.split('/').filter(Boolean)
}
