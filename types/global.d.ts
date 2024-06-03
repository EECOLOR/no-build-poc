declare module '*.css' {
  const x: { [any: string]: string }
  export default x
}

declare module '*?fingerprint' {
  const x: string
  export default x
}
