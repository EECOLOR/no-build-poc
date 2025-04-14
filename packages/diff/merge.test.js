import { describe, test, it } from 'node:test' // 'it' is an alias for 'test'
import assert from 'node:assert/strict'
import { mergeChanges } from './merge.js' // <-- ADJUST THIS PATH

describe('mergeChanges Function (Revised Logic & Inputs)', () => {
  describe('Basic and Empty Cases', () => {
    test('should return empty array for empty input', () => {
      assert.deepStrictEqual(mergeChanges([]), [])
    })

    test('should handle a single added change block', () => {
      assert.deepStrictEqual(
        mergeChanges(
          [{ added: true, value: 'abcdef' }]
        ),
        [{ value: 'abcdef', added: true }]
      )
    })

    test('should handle a single removed change block', () => {
      assert.deepStrictEqual(
        mergeChanges(
          [{ removed: true, value: 'abcdef' }]
        ),
        [{ value: 'abcdef', removed: true }]
      )
    })

    test('should handle a single large unchanged change block', () => {
      assert.deepStrictEqual(
        mergeChanges(
          [{ value: 'abcdefg' }] // length > 2
        ),
        [{ value: 'abcdefg' }],
        'Passes through a single large unchanged block'
      )
    })

    test('should handle only single small unchanged changes', () => {
      assert.deepStrictEqual(
        mergeChanges([{ value: 'a' }]),
        [{ value: 'a' }]
      )
       assert.deepStrictEqual(
        mergeChanges([{ value: 'xy' }]),
        [{ value: 'xy' }]
      )
    })

    test('should handle only small unchanged changes resulting in empty string', () => {
      assert.deepStrictEqual(
        mergeChanges([{ value: '' }]),
        [],
        'Correctly handles empty small unchanged segments'
      )
    })
  })

  describe('Small Unchanged Segment Handling (length <= 2)', () => {

    test('should merge small unchanged between added and removed', () => {
      assert.deepStrictEqual(
        mergeChanges([
          { added: true, value: 'aaa' },
          { value: 'x' },
          { removed: true, value: 'bbb' },
        ]),
        [
          { value: 'xbbb', removed: true },
          { value: 'aaax', added: true },
        ]
      )
    })

    test('should merge small unchanged between removed and added', () => {
      assert.deepStrictEqual(
        mergeChanges([
          { removed: true, value: 'aaa' },
          { value: 'x' },
          { added: true, value: 'bbb' },
        ]),
        [
          { value: 'aaax', removed: true },
          { value: 'xbbb', added: true },
        ]
      )
    })

     test('should handle sequence with alternating small unchanged', () => {
      assert.deepStrictEqual(
        mergeChanges([
          { added: true, value: 'a' },
          { value: 'x' },
          { removed: true, value: 'b' },
          { value: 'y' },
          { added: true, value: 'c' },
        ]),
        [
          { value: 'xby', removed: true },
          { value: 'axyc', added: true },
        ]
      )
    })

    test('should handle small unchanged at the start (preceded by nothing)', () => {
       assert.deepStrictEqual(
        mergeChanges(
          [
            { value: 'x' },
            { added: true, value: 'a' },
          ]),
        [
          { value: 'x', removed: true },
          { value: 'xa', added: true }
        ]
      )
    })

     test('should handle small unchanged at the end (followed by nothing)', () => {
       assert.deepStrictEqual(
        mergeChanges(
          [
            { added: true, value: 'a' },
            { value: 'x' }
          ]
        ),
        [
          { value: 'x', removed: true },
          { value: 'ax', added: true }
        ]
      )
    })
  })

  describe('Large Unchanged Segment Handling (length > 2)', () => {

    test('should flush accumulated changes before large unchanged', () => {
      assert.deepStrictEqual(
        mergeChanges([
          { added: true, value: 'aaa' },
          { removed: true, value: 'bbb' },
          { value: 'XYZ123' },
          { added: true, value: 'ccc' },
        ]),
        [
          { value: 'bbb', removed: true },
          { value: 'aaa', added: true },
          { value: 'XYZ123' },
          { value: 'ccc', added: true },
        ]
      )
    })

     test('should handle large unchanged at the start', () => {
        assert.deepStrictEqual(
        mergeChanges([
          { value: 'START' },
          { added: true, value: 'a' },
          { removed: true, value: 'b' },
        ]),
        [
          { value: 'START' },
          { value: 'b', removed: true },
          { value: 'a', added: true },
        ]
      )
    })

     test('should handle large unchanged at the end', () => {
        assert.deepStrictEqual(
        mergeChanges([
          { added: true, value: 'a' },
          { removed: true, value: 'b' },
          { value: 'END' },
        ]),
        [
          { value: 'b', removed: true },
          { value: 'a', added: true },
          { value: 'END' },
        ]
      )
    })

    test('should not flush if nothing is accumulated before large unchanged', () => {
      assert.deepStrictEqual(
        mergeChanges([
          { value: 'XYZ' },
          { added: true, value: 'a' },
          { value: 'ABC' },
        ]),
        [
          { value: 'XYZ' },
          { value: 'a', added: true },
          { value: 'ABC' },
        ]
      )
    })

    test('should handle flush between add/large_unchanged/remove', () => {
      assert.deepStrictEqual(
        mergeChanges([
          { added: true, value: 'a' },
          { value: 'XYZABC' },
          { removed: true, value: 'b' }
        ]),
        [
          { value: 'a', added: true },
          { value: 'XYZABC' },
          { value: 'b', removed: true },
        ]
      )
    })

    test('should correctly flush accumulated text including absorbed small unchanged before large block', () => {
      assert.deepStrictEqual(
        mergeChanges([
          { added: true, value: 'A' },
          { value: 'x' },
          { removed: true, value: 'B' },
          { value: 'XYZ_LARGE' },
        ]),
        [
          { value: 'xB', removed: true },
          { value: 'Ax', added: true },
          { value: 'XYZ_LARGE' },
        ]
      )
    })

    test('should correctly handle final push when rem !== add after absorption', () => {
      assert.deepStrictEqual(
        mergeChanges([
          { value: 'XYZ_LARGE' },
          { added: true, value: 'A' },
          { value: 'x' },
          { removed: true, value: 'B' },
        ]),
        [
            { value: 'XYZ_LARGE' },
            { value: 'xB', removed: true },
            { value: 'Ax', added: true },
        ]
      )
    })

    test('should handle multiple flushes involving absorbed small segments', () => {
      assert.deepStrictEqual(
        mergeChanges([
            { added: true, value: 'A' },
            { value: 'x' },
            { removed: true, value: 'DEL1'},
            { value: 'LARGE1' },
            { added: true, value: 'ADD1' },
            { value: 'y' },
            { removed: true, value: 'DEL2'},
            { value: 'LARGE2' },
            { added: true, value: 'C' },
        ]),
        [
          { value: 'xDEL1', removed: true },
          { value: 'Ax', added: true },
          { value: 'LARGE1' },
          { value: 'yDEL2', removed: true },
          { value: 'ADD1y', added: true },
          { value: 'LARGE2' },
          { value: 'C', added: true }
        ]
      )
    })
  })

  describe('Mixed and Complex Cases', () => {
    test('should handle complex mix of operations', () => {
      assert.deepStrictEqual(
        mergeChanges([
          { added: true, value: 'ins1' },
          { value: 'xy' },
          { removed: true, value: 'del1' },
          { value: 'LONG UNCHANGED' },
          { added: true, value: 'ins2' },
          { removed: true, value: 'del2' },
          { value: 'z' },
          { added: true, value: 'ins3' },
        ]),
        [
          { value: 'xydel1', removed: true },
          { value: 'ins1xy', added: true },
          { value: 'LONG UNCHANGED' },
          { value: 'del2z', removed: true },
          { value: 'ins2zins3', added: true },
        ]
      )
    })

     test('should handle input ending with added/removed', () => {
      assert.deepStrictEqual(
        mergeChanges([
          { value: 'KeepThis' },
          { added: true, value: 'add1' },
          { removed: true, value: 'rem1' }
        ]),
        [
          { value: 'KeepThis' },
          { value: 'rem1', removed: true },
          { value: 'add1', added: true }
        ]
      )
    })

     test('should handle input ending with small unchanged', () => {
      assert.deepStrictEqual(
        mergeChanges([
          { value: 'KeepThis' },
          { added: true, value: 'add1' },
          { value: 'x' }
        ]),
        [
          { value: 'KeepThis' },
          { value: 'x', removed: true },
          { value: 'add1x', added: true }
        ]
      )
    })

    test('should correctly flush only removed text if only that was accumulated', () => {
      assert.deepStrictEqual(
        mergeChanges([
          { removed: true, value: 'A' },
          { value: 'XYZ_LARGE' },
          { added: true, value: 'B' },
        ]),
        [
          { value: 'A', removed: true },
          { value: 'XYZ_LARGE' },
          { value: 'B', added: true }
        ]
      )
    })
  })
})
