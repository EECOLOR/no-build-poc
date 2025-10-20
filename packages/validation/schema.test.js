import { test, describe } from 'node:test'
import assert from 'node:assert'
import { string, object, SchemaError, typeIssue, validationIssue, invalid, number, array, or, constant, boolean, isConstant } from './schema.js'

/** @import { TypeValidator, TypeIssue, ValidationIssue } from './types.ts' */

describe('string Validator', () => {
  describe('a valid string should be returned', () => {
    testSuccess({
      schema: string(),
      input: 'hello',
      typed: 'hello'
    })
  })

  describe('a non-string value should throw a SchemaError', () => {
    testFailure({
      schema: string(),
      input: 123,
      issues: [{ kind: 'type', path: [], validator: string }]
    })
  })

  describe('an optional validator should pass', () => {
    testSuccess({
      schema: string(isLongerThan2),
      input: 'abc',
      typed: 'abc'
    })

    /** @arg {string} value } */
    function isLongerThan2(value) { return value.length > 2 }
  })

  describe('an optional validator should fail when it returns false', () => {
    testFailure({
      schema: string(isLargerThan5),
      input: 'abc',
      issues: [{ kind: 'validation', path: [], validator: isLargerThan5 }]
    })

    /** @arg {string} value */
    function isLargerThan5(value) { return value.length > 5 }
  })

  describe('an empty string should be valid', () => {
    testSuccess({
      schema: string(),
      input: '',
      typed: ''
    })
  })

  describe('a string with leading/trailing spaces should be valid', () => {
    testSuccess({
      schema: string(),
      input: '  hello  ',
      typed: '  hello  '
    })
  })
})

describe('number Validator', () => {
  describe('a valid number should be returned', () => {
    testSuccess({
      schema: number(),
      input: 123,
      typed: 123
    })
  })

  describe('a non-number value should throw a SchemaError', () => {
    testFailure({
      schema: number(),
      input: 'hello',
      issues: [{ kind: 'type', path: [], validator: number }]
    })
  })

  describe('an optional validator should pass', () => {
    testSuccess({
      schema: number(isLargerThan10),
      input: 15,
      typed: 15
    })

    /** @arg {number} value } */
    function isLargerThan10(value) { return value > 10 }
  })

  describe('an optional validator should fail when it returns false', () => {
    testFailure({
      schema: number(isLargerThan10),
      input: 5,
      issues: [{ kind: 'validation', path: [], validator: isLargerThan10 }]
    })

    /** @arg {number} value */
    function isLargerThan10(value) { return value > 10 }
  })
})

describe('boolean Validator', () => {
  describe('a valid boolean should be returned', () => {
    testSuccess({
      schema: boolean(),
      input: true,
      typed: true
    })
  })

  describe('a non-boolean value should throw a SchemaError', () => {
    testFailure({
      schema: boolean(),
      input: 123,
      issues: [{ kind: 'type', path: [], validator: boolean }]
    })
  })

  describe('an optional validator should pass', () => {
    testSuccess({
      schema: boolean(isTrue),
      input: true,
      typed: true
    })

    /** @arg {boolean} value } */
    function isTrue(value) { return value === true }
  })

  describe('an optional validator should fail when it returns false', () => {
    testFailure({
      schema: boolean(isTrue),
      input: false,
      issues: [{ kind: 'validation', path: [], validator: isTrue }]
    })

    /** @arg {boolean} value */
    function isTrue(value) { return value === true }
  })
})

describe('constant Validator', () => {
  describe('a matching string constant should be returned', () => {
    testSuccess({
      schema: constant('SUCCESS'),
      input: 'SUCCESS',
      typed: 'SUCCESS'
    })
  })

  describe('a non-matching string constant should fail', () => {
    testFailure({
      schema: constant('SUCCESS'),
      input: 'FAILURE',
      issues: [{ kind: 'validation', path: [], validator: isConstant('SUCCESS') }]
    })
  })

  describe('a matching number constant should be returned', () => {
    testSuccess({
      schema: constant(42),
      input: 42,
      typed: 42
    })
  })

  describe('a non-matching number constant should fail', () => {
    testFailure({
      schema: constant(42),
      input: 100,
      issues: [{ kind: 'validation', path: [], validator: isConstant(42) }]
    })
  })

  describe('a matching boolean constant should be returned', () => {
    testSuccess({
      schema: constant(true),
      input: true,
      typed: true
    })
  })

  describe('a value of the wrong type should fail', () => {
    testFailure({
      schema: constant('text'),
      input: 123,
      issues: [{ kind: 'type', path: [], validator: string }]
    })
  })

  describe('an optional validator for a constant should work', () => {
    testFailure({
      schema: constant('ab', isLongerThan2),
      input: 'ab',
      issues: [{ kind: 'validation', path: [], validator: isLongerThan2 }]
    })
    /** @arg {string} value } */
    function isLongerThan2(value) { return value.length > 2 }
  })
})

describe('array Validator', () => {
  describe('a valid array of strings should be returned', () => {
    testSuccess({
      schema: array(string()),
      input: ['a', 'b', 'c'],
      typed: ['a', 'b', 'c']
    })
  })

  describe('a non-array value should throw a SchemaError', () => {
    testFailure({
      schema: array(string()),
      input: 'not an array',
      issues: [{ kind: 'type', path: [], validator: array }]
    })
  })

  describe('an array with an invalid item should throw a SchemaError', () => {
    testFailure({
      schema: array(string()),
      input: ['a', 123, 'c'],
      issues: [{ kind: 'type', path: [1], validator: string }]
    })
  })

  describe('an array of objects should be validated correctly', () => {
    const userSchema = object({ name: string() })
    testSuccess({
      schema: array(userSchema),
      input: [{ name: 'test1' }, { name: 'test2' }],
      typed: [{ name: 'test1' }, { name: 'test2' }]
    })
  })

  describe('an array of objects with an invalid item should throw a SchemaError', () => {
    const userSchema = object({ name: string() })
    testFailure({
      schema: array(userSchema),
      input: [{ name: 'test1' }, { name: 123 }],
      issues: [{ kind: 'type', path: [1, 'name'], validator: string }]
    })
  })

  describe('an array-level validator should be able to fail', () => {
    testFailure({
      schema: array(string(), notEmpty),
      input: [],
      issues: [{ kind: 'validation', path: [], validator: notEmpty }]
    })

    /** @arg {Array<unknown>} value */
    function notEmpty(value) { return value.length > 0 }
  })
})

describe('object Validator', () => {
  const userSchema = object({ name: string() })
  describe('a valid object against a basic schema should be returned', () => {
    testSuccess({
      schema: userSchema,
      input: { name: 'test' },
      typed: { name: 'test' }
    })
  })

  describe('an object with an invalid property should throw a SchemaError', () => {
    testFailure({
      schema: userSchema,
      input: { name: 123 },
      issues: [{ kind: 'type', path: ['name'], validator: string }]
    })
  })

  describe('a null value should fail', () => {
    testFailure({
      schema: userSchema,
      input: null,
      issues: [{ kind: 'type', path: [], validator: object }]
    })
  })

  describe('an object should be able to handle an optional property that is missing', () => {
    const userSchema = object({ id: string(), 'name?': string() })
    testSuccess({
      schema: userSchema,
      input: { id: '123' },
      typed: { id: '123' }
    })
  })

  describe('an object should be able to handle an optional property that is passed in', () => {
    const userSchema = object({ id: string(), 'name?': string() })
    testSuccess({
      schema: userSchema,
      input: { id: '123', name: 'name' },
      typed: { id: '123', name: 'name' }
    })
  })

  describe('an object with a missing property should throw a SchemaError', () => {
    testFailure({
      schema: userSchema,
      input: {},
      issues: [{ kind: 'type', path: ['name'], validator: string }]
    })
  })

  const appSchema = object({
    user: object({
      profile: object({
        id: string(),
      })
    })
  })
  describe('an object with a nested invalid property should throw an error with the correct path', () => {
    testFailure({
      schema: appSchema,
      input: { user: { profile: { id: 123 } } },
      issues: [{ kind: 'type', path: ['user', 'profile', 'id'], validator: string }]
    })
  })

  const userSchemaWithValidator = object({ name: string() }, longerThan5)
  /** @arg {{ name: string }} value */
  function longerThan5(value) { return value.name.length > 5 }
  describe('an optional validator for the entire object should pass', () => {
    testSuccess({
      schema: userSchemaWithValidator,
      input: { name: 'longname' },
      typed: { name: 'longname' }
    })
  })

  describe('an optional validator for the entire object should fail', () => {
    testFailure({
      schema: userSchemaWithValidator,
      input: { name: 'short' },
      issues: [{ kind: 'validation', path: [], validator: longerThan5 }]
    })
  })

  describe('an object with an extra, un-schemed property should still be valid', () => {
    testSuccess({
      schema: userSchema,
      input: { name: 'test', extraProp: 123 },
      typed: { name: 'test', extraProp: 123 }
    })
  })

  test('parse should return the same object (identity-wise)', () => {
    const input = { name: 'test' }
    const result = userSchema.parse(input)
    assert.strictEqual(result, input)
  })

  describe('wildcard property validator', () => {
    const strictUserSchema = object({ name: string(), '*': invalid() })
    describe('an object with an un-schemed property should fail', () => {
      testFailure({
        schema: strictUserSchema,
        input: { name: 'test', extraProp: 123 },
        issues: [{ kind: 'type', path: ['extraProp'], validator: invalid }]
      })
    })

    const wildcardStringSchema = object({ name: string(), '*': string() })
    describe('an object with an un-schemed string property should pass', () => {
      testSuccess({
        schema: wildcardStringSchema,
        input: { name: 'test', extraProp: 'hello' },
        typed: { name: 'test', extraProp: 'hello' }
      })
    })

    describe('an object with an un-schemed non-string property should fail', () => {
      testFailure({
        schema: wildcardStringSchema,
        input: { name: 'test', extraProp: 123 },
        issues: [{ kind: 'type', path: ['extraProp'], validator: string }]
      })
    })
  })
})

describe('or Validator', () => {
  const stringOrNumber = or(string(), number())
  const userOrGuest = or(
    object({ type: string(isUser), name: string() }),
    object({ type: string(isGuest) })
  )
  /** @arg {string} value */
  function isUser(value) { return value === 'user' }
  /** @arg {string} value */
  function isGuest(value) { return value === 'guest' }

  describe('a value matching the first schema should pass', () => {
    testSuccess({
      schema: stringOrNumber,
      input: 'hello',
      typed: 'hello'
    })
  })

  describe('a value matching the second schema should pass', () => {
    testSuccess({
      schema: stringOrNumber,
      input: 123,
      typed: 123
    })
  })

  describe('a value matching neither schema should fail', () => {
    testFailure({
      schema: stringOrNumber,
      input: true,
      issues: [
        typeIssue([], string),
        typeIssue([], number),
      ]
    })
  })

  describe('a complex object matching the first schema should pass', () => {
    testSuccess({
      schema: userOrGuest,
      input: { type: 'user', name: 'Alice' },
      typed: { type: 'user', name: 'Alice' }
    })
  })

  describe('a complex object matching the second schema should pass', () => {
    testSuccess({
      schema: userOrGuest,
      input: { type: 'guest' },
      typed: { type: 'guest' }
    })
  })

  describe('a complex object failing one part of the first schema, but passing the second, should pass', () => {
    const strictUserOrGuest = or(
      object({ type: string(isUser), name: string() }),
      object({ type: string(isGuest), 'name?': string() })
    )
    testSuccess({
      schema: strictUserOrGuest,
      input: { type: 'guest', name: 'Alice' },
      typed: { type: 'guest', name: 'Alice' }
    })
  })

  describe('a complex object matching neither schema should fail with aggregated issues', () => {
    testFailure({
      schema: userOrGuest,
      input: { type: 'admin', role: 'super' },
      issues: [
        validationIssue(['type'], isUser),
        typeIssue(['name'], string),
        validationIssue(['type'], isGuest),
      ]
    })
  })

  describe('a null value should fail', () => {
    testFailure({
      schema: stringOrNumber,
      input: null,
      issues: [
        typeIssue([], string),
        typeIssue([], number),
      ]
    })
  })

  describe('an array-level validation for or should work', () => {
    /** @arg {Array<unknown>} value */
    function hasMinLength(value) { return value.length >= 2 }
    const arrayOrString = or(array(string(), hasMinLength), string())

    testSuccess({
      schema: arrayOrString,
      input: ['a', 'b'],
      typed: ['a', 'b']
    })

    testFailure({
      schema: arrayOrString,
      input: ['a'],
      issues: [
        validationIssue([], hasMinLength),
        typeIssue([], string)
      ]
    })
  })
})

describe('SchemaError and Helper Functions', () => {
  test('SchemaError should format the error message correctly', () => {
    const issues = [
      typeIssue(['user', 'name'], string),
      validationIssue(
        ['age'],
        /** @arg {number} value */ function isLargerThan18(value) { return value > 18 }
      )
    ]
    const error = new SchemaError(issues)
    assert.strictEqual(error.message, 'Validation failed, 2 issues:\n- user/name: (type) string\n- age: (validation) isLargerThan18')
  })

  test('typeIssue and validationIssue should create the correct issue objects', () => {
    const typeIssueResult = typeIssue(['name'], string)
    assert.deepStrictEqual(typeIssueResult, { kind: 'type', path: ['name'], validator: string })

    const validationIssueResult = validationIssue(['age'], alwaysValid)
    assert.deepStrictEqual(validationIssueResult, { kind: 'validation', path: ['age'], validator: alwaysValid })

    function alwaysValid() { return true }
  })
})

/** @arg {{ schema: TypeValidator<any>, input: unknown, typed: any }} options */
function testSuccess({ schema, input, typed }) {
  test('parse() should return the typed value', () => {
    const result = schema.parse(input)
    assert.deepStrictEqual(result, typed)
  })

  test('tryParse() should return a success object', () => {
    const result = schema.tryParse(input)
    assert.deepStrictEqual(result, { success: true, typed })
  })
}

/** @arg {{ schema: TypeValidator<any>, input: unknown, issues: Array<TypeIssue | ValidationIssue> }} options */
function testFailure({ schema, input, issues }) {
  test('parse() should throw a SchemaError', () => {
    assert.throws(() => schema.parse(input), new SchemaError(issues))
  })

  test('tryParse() should return a failure object', () => {
    const result = schema.tryParse(input)
    assert.deepStrictEqual(result, { failure: true, issues })
  })
}
