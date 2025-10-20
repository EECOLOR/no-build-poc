import { test, describe } from 'node:test'
import assert from 'node:assert'
import path from 'path'
import { fileURLToPath } from 'url'
import { compileAndGetDiagnostics } from '#typescript/compileCode.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const commonSetup = `
  import { string, object, number, boolean, array, or, invalid, constant } from '${__dirname}/schema.js'
  function expectAssignable<T>(arg: T): void {}
`

const { testCases, inMemoryFiles } = createTestCases({
  success: {
    'string() returns a string': `
      const validator = string()
      const result = validator.parse(null)
      expectAssignable<string>(result)
    `,
    'object() returns a correctly typed object': `
      const schema = object({ name: string() })
      const result = schema.parse(null)
      expectAssignable<{ name: string }>(result)
    `,
    'nested object returns a correctly typed object': `
      const schema = object({ user: object({ name: string() }) })
      const result = schema.parse(null)
      expectAssignable<{ user: { name: string } }>(result)
    `,
    'number() returns a number': `
      const validator = number()
      const result = validator.parse(null)
      expectAssignable<number>(result)
    `,
    'array(string()) returns a string[]': `
      const validator = array(string())
      const result = validator.parse(null)
      expectAssignable<Array<string>>(result)
    `,
    'array(object()) returns a correctly typed object array': `
      const schema = array(object({ name: string() }))
      const result = schema.parse(null)
      expectAssignable<Array<{ name: string }>>(result)
    `,
    'string() validator infers a string': `
      string(value => { expectAssignable<string>(value); return true })
    `,
    'number() validator infers a number': `
      number(value => { expectAssignable<number>(value); return true })
    `,
    'array(string()) validator infers a string[]': `
      array(string(), value => { expectAssignable<string[]>(value); return true })
    `,
    'object({}) validator infers an object': `
      object({}, value => { expectAssignable<{}>(value); return true })
    `,
    'object({ name: string() }) validator infers an object with name property': `
      object({ name: string() }, value => { expectAssignable<{ readonly name: string }>(value); return true })
    `,
    'nested object validator infers a nested object': `
      object({ user: object({ name: string() }) }, value => { expectAssignable<{ readonly user: { readonly name: string } }>(value); return true })
    `,
    'array of objects validator infers an array of objects': `
      array(object({ name: string() }), value => { expectAssignable<Array<{ readonly name: string }>>(value); return true })
    `,
    'or(string(), number()) returns a union type string | number': `
      const validator = or(string(), number())
      const result = validator.parse(null)
      expectAssignable<string | number>(result)
    `,
    'or() with complex objects returns a union of object types': `
      const userSchema = object({ type: string(), name: string() })
      const guestSchema = object({ type: string(), id: number() })
      const validator = or(userSchema, guestSchema)
      const result = validator.parse(null)
      expectAssignable<{ readonly type: string, readonly name: string } | { readonly type: string, readonly id: number }>(result)
    `,
    'or() validator infers a union type in the validator function': `
      const validator = or(string(), number())
      const result = validator.parse(null)
      expectAssignable<string | number>(result)
    `,
    'boolean() returns a boolean': `
      const validator = boolean()
      const result = validator.parse(null)
      expectAssignable<boolean>(result)
    `,
    'constant() returns a string literal type': `
      const validator = constant('foo')
      const result = validator.parse(null)
      expectAssignable<'foo'>(result)
    `,
    'object() with optional property returns a Partial property': `
      const schema = object({ id: number(), 'name?': string() })
      const result = schema.parse(null)
      expectAssignable<{ readonly id: number, readonly name?: string }>(result)
    `,
    'invalid() parse returns never': `
      const validator = invalid()
      const result = validator.parse(null)
      expectAssignable<never>(result)
    `,
  },
  failure: {
    'array(string()) result is not assignable to number[]': {
      code: `
        const validator = array(string())
        const result = validator.parse(null)
        expectAssignable<Array<number>>(result)
      `,
      expectedErrors: [
        `Argument of type 'string[]' is not assignable to parameter of type 'number[]'.\n  Type 'string' is not assignable to type 'number'.`
      ]
    },
    'number() result is not assignable to string': {
      code: `
        const validator = number()
        const result = validator.parse(null)
        expectAssignable<string>(result)
      `,
      expectedErrors: [
        `Argument of type 'number' is not assignable to parameter of type 'string'.`
      ]
    },
    'string() result is not assignable to number': {
      code: `
        const validator = string()
        const result = validator.parse(null)
        expectAssignable<number>(result)
      `,
      expectedErrors: [
        `Argument of type 'string' is not assignable to parameter of type 'number'.`
      ]
    },
    'object() fails when assigning to a type with invalid property types': {
      code: `
        const schema = object({ name: string() })
        const result = schema.parse(null)
        expectAssignable<{ name: number }>(result)
      `,
      expectedErrors: [
        `Argument of type '{ readonly name: string; }' is not assignable to parameter of type '{ name: number; }'.\n` +
        `  Types of property 'name' are incompatible.\n` +
        `    Type 'string' is not assignable to type 'number'.`
      ]
    },
    'or(string(), number()) result is not assignable to just string': {
      code: `
        const validator = or(string(), number())
        const result = validator.parse(null)
        expectAssignable<string>(result)
      `,
      expectedErrors: [
        `Argument of type 'string | number' is not assignable to parameter of type 'string'.\n  Type 'number' is not assignable to type 'string'.`
      ]
    },
    'or(string(), number()) result is not assignable to just number': {
      code: `
        const validator = or(string(), number())
        const result = validator.parse(null)
        expectAssignable<number>(result)
      `,
      expectedErrors: [
        `Argument of type 'string | number' is not assignable to parameter of type 'number'.\n  Type 'string' is not assignable to type 'number'.`
      ]
    },
    'or() with complex object union is not assignable to a non-union type': {
      code: `
        const userSchema = object({ type: string(), name: string() })
        const guestSchema = object({ type: string(), id: number() })
        const validator = or(userSchema, guestSchema)
        const result = validator.parse(null)
        expectAssignable<{ type: string, name: string }>(result)
      `,
      expectedErrors: [
        `Argument of type '{ readonly type: string; readonly name: string; } | { readonly type: string; readonly id: number; }' is not assignable to parameter of type '{ type: string; name: string; }'.\n` +
        `  Property 'name' is missing in type '{ readonly type: string; readonly id: number; }' but required in type '{ type: string; name: string; }'.`
      ]
    },
    'constant() result is not assignable to a different literal type': {
      code: `
        const validator = constant('foo')
        const result = validator.parse(null)
        expectAssignable<'bar'>(result)
      `,
      expectedErrors: [
        `Argument of type '"foo"' is not assignable to parameter of type '"bar"'.`
      ]
    },
  }
})

console.log('Compiling test cases...')
const diagnostics = compileAndGetDiagnostics(inMemoryFiles)

describe('TypeScript Type Tests', () => {
  describe('Successful Type Inferences', () => {
    for (const testId in testCases.success) {
      test(testId, () => { expectNoErrors(testId); })
    }
  })

  describe('Expected Type Errors', () => {
    for (const testId in testCases.failure) {
      test(testId, () => { expectErrors(testId, testCases.failure[testId].expectedErrors) }); }
  })
})

/**
 * Asserts that the provided test ID compiles without type errors.
 * @param {string} testId
 */
function expectNoErrors(testId) {
  const codeDiagnostics = getRelevantDiagnostics('success', testId)
  assert.strictEqual(codeDiagnostics.length, 0, `Expected no type errors for test case '${testId}', but found:\n${codeDiagnostics.join('\n')}`)
}

/**
 * Asserts that the provided test ID produces a type error.
 * @param {string} testId
 * @param {Array<string>} expectedErrors
 */
function expectErrors(testId, expectedErrors) {
  const codeDiagnostics = getRelevantDiagnostics('failure', testId)

  const errorCount = Math.max(codeDiagnostics.length, expectedErrors.length)

  for (let i = 0; i < errorCount; i++) {
    const actual = codeDiagnostics[i]
    const expected = expectedErrors[i]
    assert.strictEqual(actual, expected, `Error at index ${i} for test '${testId}' does not match expected.`)
  }
}

/** @arg {keyof typeof testCases} group @arg {string} testId */
function getRelevantDiagnostics(group, testId) {
  const fileName = getTestFileName(group, testId)
  return diagnostics.filter(d => d.fileName && d.fileName.endsWith(fileName)).map(d => d.message)
}

/**
 * @arg {{
 *   success: { [name: string]: string }
 *   failure: { [name: string]: { code: string, expectedErrors: Array<string> } }
 * }} testCases
 */
function createTestCases(testCases) {
  /** @type {Map<string, string>} */
  const inMemoryFiles = new Map()
  /** @type {Array<string>} */
  const filesToCompile = []

  for (const testId in testCases.success) {
    addTestFile('success', testId, testCases.success[testId])
  }

  for (const testId in testCases.failure) {
    addTestFile('failure', testId, testCases.failure[testId].code)
  }

  return { testCases, inMemoryFiles }

  /** @arg {keyof typeof testCases} group @arg {string} testId @arg {string} code */
  function addTestFile(group, testId, code) {
    const fileName = getTestFileName(group, testId)
    inMemoryFiles.set(fileName, commonSetup + code)
  }
}

/** @arg {keyof typeof testCases} group @arg {string} testId */
function getTestFileName(group, testId) {
  return `test-${group}-${testId}.ts`
}
