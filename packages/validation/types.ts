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
  parse: ParseType<Expand<ResultType<T>>>
  tryParse: TryParseType<Expand<ResultType<T>>>
}

export type ParseType<T> = (value: unknown, path?: Path) => T

export type TryParseType<T> = (value: unknown, path?: Path) =>
{ success: true, typed: T } |
{ failure: true, issues: ReadonlyArray<TypeIssue | ValidationIssue>}


export type ValueValidator<T> = (value: T) => boolean

export type ResultType<T> =
  T extends string ? T :
  T extends number ? T :
  T extends TypeValidator<infer U> ? ResultType<U> :
  T extends Array<infer U> ? Array<ResultType<U>> :
  T extends ObjectSchema ? ConvertOptionalKeys<{ [key in keyof T]: ResultType<TypeValidatorType<T[key]>> }> :
  never

export type GetTryParseType<T> =
  T extends TryParseType<infer R>
    ? R
    : never;

type TypeValidatorType<T> =
  T extends TypeValidator<infer X> ? X : never

type OptionalKeys<T> = {
  [K in keyof T as K extends `${infer U}?` ? U : never]: T[K]
}

type RequiredKeys<T> = {
  [K in keyof T as K extends `${infer U}?` ? never : K]: T[K]
}

type ConvertOptionalKeys<T> = RequiredKeys<T> & Partial<OptionalKeys<T>>
