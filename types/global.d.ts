declare module '*.css' {
  const x: { [any: string]: string }
  export default x
}

declare namespace React {
  interface HTMLAttributes<T> {
    'data-banana'?: string
  }
}

declare interface ObjectConstructor {
  entries<T extends { [s: string]: any } | ArrayLike<any>, Value extends T[keyof T]>(o: T): Array<[keyof T, Value]>
  fromEntries<Key extends PropertyKey, Value>(entries: Iterable<readonly [Key, Value]>): { [k in Key]: Value }
}
