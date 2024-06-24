import { separatePropsAndChildren } from './separatePropsAndChildren.js'

/** @typedef {{ parent?: NodeContext }} NodeContext */

/** @type {NodeContext} */
let nodeContext = null

function getNodeContext() {
  return nodeContext
}

export function _setNodeContext(newNodeContext) {
  nodeContext = newNodeContext
}

/**
 * @template T
 * @param {T} constructor
 * @returns {(...params: Parameters<T>) => Component<T>}
 */
export function component(constructor) {
  return (...params) => {
    const { props, children } = separatePropsAndChildren(params)
    return new Component(constructor, props, children)
  }
}

/** @template T */
export class Component {
  constructor(constructor, props, children) {
    this.constructor = constructor
    this.props = props
    this.children = children
  }
}

/**
 * @template T
 * @typedef {<R extends Array<any>>(props: { value: T }, ...children: R) => R} ProviderFunction
 */

/**
 * @template T
 * @returns {{
 *   Provider: (...params: Parameters<ProviderFunction<T>>) => Component<ProviderFunction<T>>,
 *   consume(): T,
 * }}
 */
export function createContext() {
  const contextId = Symbol('context-id')

  return {
    Provider: component(({ value }, ...children) => {
      if (!value) throw new Error('No value has been provided to provider')
      const currentComponentNode = getNodeContext()
      currentComponentNode[contextId] = value
      return children
    }),
    consume() {
      const currentComponentNode = getNodeContext()
      const $value = findContextValue(currentComponentNode, contextId)
      return $value
    },
  }
}

function findContextValue(node, contextId) {
  let current = node
  while (current) {
    const value = current[contextId]
    if (value) return value
    current = current.parent
  }
  throw new Error(`Could not find value for context, did you create a Provider?`)
}
