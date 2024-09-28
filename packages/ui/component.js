import { separatePropsAndChildren } from './utils.js'

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
      const nodeContext = getNodeContext()
      nodeContext[contextId] = value
      return children
    }),
    consume() {
      const nodeContext = getNodeContext()
      if (!nodeContext?.parent) throw new Error(`It is unsafe to call 'consume' outside of a component, please wrap you component like this: 'component((props, ...children) => { ... })'`)
      return findContextValue(nodeContext, contextId)
    },
  }
}

function findContextValue(nodeContext, contextId) {
  let current = nodeContext
  while (current) {
    const value = current[contextId]
    if (value) return value
    current = current.parent
  }
  throw new Error(`Could not find value for context, did you create a Provider?`)
}
