import { separatePropsAndChildren } from './separatePropsAndChildren.js'

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
