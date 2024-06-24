import { separatePropsAndChildren } from './separatePropsAndChildren.js'

let currentContext = null
let currentUpdateContext = null

export function useContext() {
  if (!currentContext) throw new Error('useContext can only be used from within a component')
  return currentContext
}

export function updateContext(newValue) {
  if (!currentUpdateContext) throw new Error('updateContext can only be used from within a component')
  return currentUpdateContext(newValue)
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
 * @template {Component<any>} T
 * @template X
 * @param {T} component
 * @param {X} context
 * @returns {[ReturnType<T['constructor']>, X]}
 */
export function renderComponent({ constructor, props, children }, context) {
  const params = props ? [props].concat(children) : children

  let newContext = context
  currentUpdateContext = (newValue) => { newContext = newValue }
  currentContext = context

  const result = constructor(...params)

  currentContext = null
  currentUpdateContext = null

  return [result, newContext]
}
