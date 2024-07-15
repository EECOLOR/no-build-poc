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

/**
 * @template T
 * @template {(value: T, index?: number, a?: Array<T>) => Promise<any>} F
 * @param {Array<T>} a
 * @param {F} f
 * @returns {Promise<Array<Awaited<ReturnType<F>>>>}
 */
export function mapAsync(a, f) {
  return a.reduce(
    async (resultPromise, x, i) => {
      const result = await resultPromise
      result.push(await f(x, i, a))
      return result
    },
    Promise.resolve([])
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
