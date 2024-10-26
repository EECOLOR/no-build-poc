// This type can not be expressed in JSDoc
export type TypeOrArrayOfType<T> = T | Array<TypeOrArrayOfType<T>>
