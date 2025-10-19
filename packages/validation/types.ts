import { Expand } from '#typescript/utils.ts'

export type Path = Array<string | number | symbol>

export type ValidatorFunction = (...args: Array<any>) => any

export type TypeIssue = {
  kind: 'type'
  path: Path
  validator: ValidatorFunction
}

export type ValidationIssue = {
  kind: 'validation'
  path: Path
  validator: ValidatorFunction
}

export type ObjectSchema = {
  [key: string]: TypeValidator<unknown>
}

export type TypeValidator<T> = {
  parse(value: unknown, path?: Path): Expand<ResultType<T>>
  tryParse(value: unknown, path?: Path):
    { success: true, typed: Expand<ResultType<T>> } |
    { failure: true, issues: ReadonlyArray<TypeIssue | ValidationIssue>}
}

export type ValueValidator<T> = (value: T) => boolean

export type ResultType<T> =
  T extends string ? T :
  T extends number ? T :
  T extends TypeValidator<infer U> ? Array<Expand<ResultType<U>>> :
  T extends ObjectSchema ? ConvertOptionalKeys<{ [key in keyof T]: ResultType<TypeValidatorType<T[key]>> }> :
  never

type TypeValidatorType<T> =
  T extends TypeValidator<infer X> ? X : never

type OptionalKeys<T> = {
  [K in keyof T as K extends `${infer U}?` ? U : never]: T[K]
}

type RequiredKeys<T> = {
  [K in keyof T as K extends `${infer U}?` ? never : K]: T[K]
}

type ConvertOptionalKeys<T> = RequiredKeys<T> & Partial<OptionalKeys<T>>
