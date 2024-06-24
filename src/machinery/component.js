import { separatePropsAndChildren } from './separatePropsAndChildren.js'

let currentComponentNode = null

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
      console.log('Provider', currentComponentNode)
      currentComponentNode[contextId] = value
      return children
    }),
    consume() {
      console.log('consume', currentComponentNode)
      const $value = findContextValue(currentComponentNode, contextId)
      return $value
    },
  }
}

/**
 * @template {Component<any>} T
 * @param {T} component
 * @returns {ReturnType<T['constructor']>}
 */
export function renderComponent({ constructor, props, children }, renderResult) {
  const params = props ? [props].concat(children) : children

  // This will not work when parts of the tree are reactive, the previous version did not have this problem
  // Before you fix it, first unify the server and client renderer
  currentComponentNode = createComponentNode(currentComponentNode)
  const result = renderResult(constructor(...params))
  currentComponentNode = currentComponentNode.parent

  return result
}

function createComponentNode(parent = null) {
  return { parent }
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
