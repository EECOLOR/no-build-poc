declare module '*.css' {
  const x: { [any: string]: string }
  export default x
}

declare module '*.client.js' {
  const x: string
  export default x
}
