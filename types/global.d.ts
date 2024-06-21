declare module '*.css' {
  const x: { [any: string]: string }
  export default x
}

declare namespace React {
  interface HTMLAttributes<T> {
    'data-banana'?: string
  }
}
