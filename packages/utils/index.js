/**
 * @template T
 * @param {Array<T>} a
 * @param {{ key(x: T): string }} options
 * @returns {{ [key: string]: T }}
 */
export function createLookup(a, { key }) {
  return a.reduce((result, x) => (result[key(x)] = x, result), {})
}

/**
 * @template {object} T
 * @template {(value: T[keyof T], key?: keyof T, o?: T) => any} F
 * @param {T} o
 * @param {F} f
 * @returns {{ [key in keyof T]: ReturnType<F> }}
 */
 export function mapValues(o, f) {
  return Object.fromEntries(
    Object.entries(o).map(([k, v]) => [k, f(v, k, o)])
  )
}

export function separatePropsAndChildren(params) {
  const [propsOrChild, ...children] = params
  const hasProps = propsOrChild?.constructor === Object

  return {
    props: hasProps ? propsOrChild: null,
    children: hasProps ? children : params
  }
}
