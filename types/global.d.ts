declare module '*.css' {
  const x: { [any: string]: string }
  export default x
}

declare interface ObjectConstructor {
  entries<T extends { [s: string]: any } | ArrayLike<any>, Value extends T[keyof T]>(o: T): Array<[keyof T, Value]>
  fromEntries<Key extends PropertyKey, Value>(entries: Iterable<readonly [Key, Value]>): { [k in Key]: Value }
}

declare module '#config' {
  const x: (typeof import('../config/dev.js').default) & (typeof import('../config/default.js').default)
  export default x
}
