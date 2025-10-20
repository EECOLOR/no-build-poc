import { asConst } from '#typescript/helpers.js'

/** @import { Path, TypeValidator, ObjectSchema, ResultType, ValidationIssue, ValueValidator, ValidatorFunction, TypeIssue, TryParseType, GetTryParseType, ParseType, ConstantFunctionValidatorMap } from './types.ts' */
/** @import { ArrayToUnion, Expand } from '#typescript/utils.ts' */

/**
 * @template const T
 * @arg {T & (string | boolean | number)} constantValue
 * @arg  {Array<ValueValidator<T>>} validators
 * @returns {TypeValidator<T>}
 */
export function constant(constantValue, ...validators) {
  if (typeof constantValue === 'string') {
    const typedValidators = /** @type {Array<ValueValidator<string>>} */ (validators)
    return /** @type {TypeValidator<T>} */ (string(isConstant(constantValue), ...typedValidators))
  }
  if (typeof constantValue === 'number') {
    const typedValidators = /** @type {Array<ValueValidator<number>>} */ (validators)
    return /** @type {TypeValidator<T>} */ (number(isConstant(constantValue), ...typedValidators))
  }
  if (typeof constantValue === 'boolean') {
    const typedValidators = /** @type {Array<ValueValidator<boolean>>} */ (validators)
    return /** @type {TypeValidator<T>} */ (boolean(isConstant(constantValue), ...typedValidators))
  }

  return invalid()
}

// This is needed to be able to map constant validator functions by reference
/** @type {ConstantFunctionValidatorMap<boolean | string | number>} */
const constantFunctions = new Map()
/**
 * @template const T
 * @arg {T & (boolean | string | number)} constantValue */
export function isConstant(constantValue) {
  if (constantFunctions.has(constantValue))
    return constantFunctions.get(constantValue)

  constantFunctions.set(constantValue, isConstant)
  return isConstant

  /** @arg {boolean | string | number} value */
  function isConstant(value) {
    return value === constantValue
  }

}

/**
 * @arg  {Array<ValueValidator<string>>} validators
 * @returns {TypeValidator<string>}
 */
export function string(...validators) {
  const parse = createParse(tryParse)
  return { parse, tryParse }

  /** @type {TryParseType<string>} */
  function tryParse(value, path = []) {
    if (typeof value !== 'string')
      return asConst({ failure: true, issues: [typeIssue(path, string)] })

    const typed = value
    const issues = validateValue(typed, path, validators)

    if (issues.length)
      return asConst({ failure: true, issues })

    return asConst({ success: true, typed })
  }
}

/**
 * @template T
 * @arg {TypeValidator<T>} typeValidator
 * @arg  {Array<ValueValidator<Array<Expand<ResultType<TypeValidator<T>>>>>>} validators
 * @returns {TypeValidator<Array<T>>}
 */
export function array(typeValidator, ...validators) {
  const parse = createParse(tryParse)
  return { parse, tryParse }

  /** @type {TryParseType<Array<Expand<ResultType<TypeValidator<T>>>>>} */
  function tryParse(value, path = []) {
    if (!Array.isArray(value))
      return asConst({ failure: true, issues: [typeIssue(path, array)] })

    let issues = []
    for (let i = 0; i < value.length; i++) {
      const result = typeValidator.tryParse(value[i], path.concat(i))
      if ('failure' in result)
        issues.push(...result.issues)
    }

    if (issues.length)
      return asConst({ failure: true, issues })

    const typed = /** @type {Array<Expand<ResultType<TypeValidator<T>>>>} */ (value)
    issues = validateValue(typed, path, validators)

    if (issues.length)
      return asConst({ failure: true, issues })

    return asConst({ success: true, typed })
  }
}

/**
 * @arg  {Array<ValueValidator<number>>} validators
 * @returns {TypeValidator<number>}
 */
export function number(...validators) {
  const parse = createParse(tryParse)
  return { parse, tryParse }

  /** @type {TryParseType<number>} */
  function tryParse(value, path = []) {
    if (typeof value !== 'number')
      return asConst({ failure: true, issues: [typeIssue(path, number)] })

    const typed = value
    const issues = validateValue(typed, path, validators)

    if (issues.length)
      return asConst({ failure: true, issues })

    return asConst({ success: true, typed })
  }
}

/**
 * @arg  {Array<ValueValidator<boolean>>} validators
 * @returns {TypeValidator<boolean>}
 */
export function boolean(...validators) {
  const parse = createParse(tryParse)
  return { parse, tryParse }

  /** @type {TryParseType<boolean>} */
  function tryParse(value, path = []) {
    if (typeof value !== 'boolean')
      return asConst({ failure: true, issues: [typeIssue(path, boolean)] })

    const typed = value
    const issues = validateValue(typed, path, validators)

    if (issues.length)
      return asConst({ failure: true, issues })

    return asConst({ success: true, typed })
  }
}

/**
 * @template const T
 * @arg {T & ObjectSchema} userSchema
 * @arg {Array<ValueValidator<Expand<ResultType<T>>>>} validators
 * @returns {TypeValidator<T>}
 */
export function object(userSchema, ...validators) {
  const { '*': wildcardValidator, ...schema } = userSchema
  const schemedKeys = new Set(
    Object.keys(schema).map(key => key.endsWith('?') ? key.slice(0, -1) : key)
  )

  const parse = createParse(tryParse)
  return { parse, tryParse }

  /** @type {TryParseType<Expand<ResultType<T>>>} */
  function tryParse(value, path = []) {
    if (!isObject(value))
      return asConst({ failure: true, issues: [typeIssue(path, object)] })

    let issues = []

    // Check schemed properties
    for (const [key, keyValidator] of Object.entries(schema)) {
      if (typeof key !== 'string')
        continue

      const isOptional = key.endsWith('?')
      const actualKey = isOptional ? key.slice(0, -1) : key

      if (isOptional && !(actualKey in value))
        continue

      const result = keyValidator.tryParse(value[actualKey], path.concat(actualKey))
      if ('failure' in result)
        issues.push(...result.issues)
    }

    // Check unschemed properties
    if (wildcardValidator) {
      for (const key of Object.keys(value)) {
        if (schemedKeys.has(key))
          continue

        const result = wildcardValidator.tryParse(value[key], path.concat(key))
        if ('failure' in result)
          issues.push(...result.issues)
      }
    }

    if (issues.length)
      return asConst({ failure: true, issues })

    const typed = /** @type {Expand<ResultType<T>>} */ (value)
    issues = validateValue(typed, path, validators)

    if (issues.length)
      return asConst({ failure: true, issues })

    return asConst({ success: true, typed })
  }
}

/** @returns {TypeValidator<never>} */
export function invalid() {
  const parse = createParse(tryParse)
  return { parse, tryParse }

  /** @type {TryParseType<never>} */
  function tryParse(value, path = []) {
    return asConst({ failure: true, issues: [typeIssue(path, invalid)] })
  }
}

/**
 * @template {Array<TypeValidator<any>>} T
 * @arg {T} typeValidators
 * @returns {TypeValidator<ArrayToUnion<T>>}
 */
export function or(...typeValidators) {
  const parse = createParse(tryParse)
  return { parse, tryParse }

  /** @type {TryParseType<Expand<ResultType<ArrayToUnion<T>>>>} */
  function tryParse(value, path = []) {

    const issues = []

    for (const typeValidator of typeValidators) {
      const result = typeValidator.tryParse(value, path)
      if ('success' in result) {
        const typed = /** @type {Expand<ResultType<ArrayToUnion<T>>>} */ (result.typed)
        return asConst({ success: true, typed })
      }

      issues.push(...result.issues)
    }

    return asConst({ failure: true, issues })
  }
}

export class SchemaError extends Error {

  /** @arg {ReadonlyArray<TypeIssue | ValidationIssue>} issues */
  constructor(issues) {
    super(
      `Validation failed, ${issues.length} issues:\n` +
      `- ${issues.map(issue => `${issue.path.join('/')}: (${issue.kind}) ${issue.validator.name}`).join('\n- ')}`
    )
    this.issues = issues
  }
}

/** @arg {Path} path @arg {ValidatorFunction} validator */
export function typeIssue(path, validator) {
  return asConst({ kind: 'type', path, validator })
}

/** @arg {Path} path @arg {ValidatorFunction} validator */
export function validationIssue(path, validator) {
  return asConst({ kind: 'validation', path, validator })
}

/**
 * @template {TryParseType<any>} T
 * @arg {T} tryParse
 * @returns {ParseType<GetTryParseType<T>>}
 */
function createParse(tryParse) {

  /** @arg {unknown} value @arg {Path} path */
  return function parse(value, path = []) {
    const result = tryParse(value, path)

    if ('failure' in result)
      throwError(result.issues)

    return result.typed
  }
}

/** @arg {ReadonlyArray<TypeIssue | ValidationIssue>} issues @returns {never} */
function throwError(issues) {
  throw new SchemaError(issues)
}

/**
 * @template T
 * @arg {T} typed
 * @arg {Path} path
 * @arg {Array<ValueValidator<T>>} validators
 * @returns {Array<ValidationIssue>}
 */
function validateValue(typed, path, validators) {
  const issues = []
  for (const validator of validators) {
    const valid = validator(typed)
    if (!valid)
      issues.push(validationIssue(path, validator))
  }
  return issues
}

/** @arg {unknown} x @return {x is { [key: string | number | symbol]: unknown }} */
function isObject(x) {
  if (typeof x !== 'object' || x === null)
    return false

  const proto = Object.getPrototypeOf(x)
  return proto === null || proto.constructor === Object
}
