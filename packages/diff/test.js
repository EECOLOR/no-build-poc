// Thanks to AI for generating the tests :-D

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { diff } from './index.js'

describe('Myers Diff Algorithm Implementation', () => {
  describe('Basic Diff Cases', () => {
    test('should return empty array for identical strings', () => {
      assert.deepStrictEqual(
        diff('abc', 'abc'),
        []
      )
    })

    test('should detect simple addition at the end', () => {
      assert.deepStrictEqual(
        diff('abc', 'abcd'),
        [
          { value: 'abc' },
          { added: true, value: 'd' }
        ]
      )
    })

    test('should detect simple removal at the end', () => {
      assert.deepStrictEqual(
        diff('abcd', 'abc'),
        [
          { value: 'abc' },
          { removed: true, value: 'd' }
        ]
      )
    })

    test('should detect simple addition at the beginning', () => {
      assert.deepStrictEqual(
        diff('abc', 'xabc'),
        [
          { added: true, value: 'x' },
          { value: 'abc' }
        ]
      )
    })

    test('should detect simple removal at the beginning', () => {
      assert.deepStrictEqual(
        diff('xabc', 'abc'),
        [
          { removed: true, value: 'x' },
          { value: 'abc' }
        ]
      )
    })

    test('should detect simple addition in the middle', () => {
      assert.deepStrictEqual(
        diff('abc', 'abxc'),
        [
          { value: 'ab' },
          { added: true, value: 'x' },
          { value: 'c' }
        ]
      )
    })

    test('should detect simple removal in the middle', () => {
      assert.deepStrictEqual(
        diff('abxc', 'abc'),
        [
          { value: 'ab' },
          { removed: true, value: 'x' },
          { value: 'c' }
        ]
      )
    })

    test('should detect simple replacement (remove then add)', () => {
      assert.deepStrictEqual(
        diff('abc', 'axc'),
        [
          { value: 'a' },
          { removed: true, value: 'b' },
          { added: true, value: 'x' },
          { value: 'c' }
        ]
      )
    })
  })

  describe('Edge Cases: Empty Strings', () => {
    test('should handle both strings empty', () => {
      assert.deepStrictEqual(
        diff('', ''),
        []
      )
    })

    test('should handle old string empty (all additions)', () => {
      assert.deepStrictEqual(
        diff('', 'abc'),
        [{ added: true, value: 'abc' }]
      )
    })

    test('should handle new string empty (all removals)', () => {
      assert.deepStrictEqual(
        diff('abc', ''),
        [{ removed: true, value: 'abc' }]
      )
    })
  })

  describe('Edge Cases: Common Prefix/Suffix (trimUnchangedEnds)', () => {
    test('should handle common prefix correctly', () => {
      assert.deepStrictEqual(
        diff('abcd', 'abcx'),
        [
          { value: 'abc' },
          { removed: true, value: 'd' },
          { added: true, value: 'x' }
        ]
      )
    })

    test('should handle common suffix correctly', () => {
      assert.deepStrictEqual(
        diff('abcd', 'xbcd'),
        [
          { removed: true, value: 'a' },
          { added: true, value: 'x' },
          { value: 'bcd' }
        ]
      )
    })

    test('should handle common prefix and suffix correctly', () => {
      assert.deepStrictEqual(
        diff('abc', 'axc'),
        [
          { value: 'a' },
          { removed: true, value: 'b' },
          { added: true, value: 'x' },
          { value: 'c' }
        ]
      ) // Same as simple replacement, relies on trim
    })

    test('should handle one string being a prefix of the other (removal)', () => {
      assert.deepStrictEqual(
        diff('abcdef', 'abc'),
        [
          { value: 'abc' },
          { removed: true, value: 'def' }
        ]
      )
    })

    test('should handle one string being a prefix of the other (addition)', () => {
      assert.deepStrictEqual(
        diff('abc', 'abcdef'),
        [
          { value: 'abc' },
          { added: true, value: 'def' }
        ]
      )
    })

    test('should handle only common prefix/suffix (middle removed)', () => {
        assert.deepStrictEqual(
          diff('prefix_middle_suffix', 'prefix__suffix'),
          [
            { value: 'prefix_' },
            { removed: true, value: 'middle' },
            { value: '_suffix' }
          ]
        )
    })

     test('should handle only common prefix/suffix (middle added)', () => {
        assert.deepStrictEqual(
          diff('prefix__suffix', 'prefix_middle_suffix'),
          [
            { value: 'prefix_' },
            { added: true, value: 'middle' },
            { value: '_suffix' }
          ]
        )
    })
  })

  describe('Merging Consecutive Changes', () => {
    test('should merge consecutive additions', () => {
      assert.deepStrictEqual(
        diff('ab', 'axyzb'),
        [
          { value: 'a' },
          { added: true, value: 'xyz' },
          { value: 'b' }
        ]
      )
    })

    test('should merge consecutive removals', () => {
      assert.deepStrictEqual(
        diff('axyzb', 'ab'),
        [
          { value: 'a' },
          { removed: true, value: 'xyz' },
          { value: 'b' }
        ]
      )
    })
  })

  describe('Complex Changes and Branch Coverage Targets', () => {
    test('should handle complex sequence of adds, removes, and unchanged', () => {
      assert.deepStrictEqual(
        diff(
          'The quick brown fox jumps over the lazy dog',
          'The slow white fox leaps over the sleepy dog'
        ),
        [
          { value: 'The ' },
          { removed: true, value: 'quick br' },
          { added: true, value: 'sl' },
          { value: 'ow' },
          { removed: true, value: 'n' },
          { value: ' ' },
          { added: true, value: 'white ' },
          { value: 'fox ' },
          { removed: true, value: 'jum' },
          { added: true, value: 'lea' },
          { value: 'ps over the ' },
          { added: true, value: 's' },
          { value: 'l' },
          { removed: true, value: 'az' },
          { added: true, value: 'eep' },
          { value: 'y dog' }
        ]
      )
    })

    test('should handle differing lengths significantly (target diagonal pruning - old longer)', () => {
        // This case forces paths to hit the `newLen` boundary early, triggering `minDiagonalToConsider` updates.
        assert.deepStrictEqual(
          diff(
            'abcdefghijklmnopqrstuvwxyz',
            'abcxyz'
          ),
          [
            { value: 'abc' },
            { removed: true, value: 'defghijklmnopqrstuvw' },
            { value: 'xyz' }
          ]
        )
    })

     test('should handle differing lengths significantly (target diagonal pruning - new longer)', () => {
        // This case forces paths to hit the `oldLen` boundary early, triggering `maxDiagonalToConsider` updates.
        assert.deepStrictEqual(
          diff(
            'abcxyz',
            'abcdefghijklmnopqrstuvwxyz'
          ),
          [
            { value: 'abc' },
            { added: true, value: 'defghijklmnopqrstuvw' },
            { value: 'xyz' }
          ]
        )
    })

    test('should handle replacements requiring backtracking and path choices', () => {
        // This type of input often exercises the logic where both addition and removal are possible.
        assert.deepStrictEqual(
          diff(
            'banana',
            'atana'
          ),
          [
            { removed: true, value: 'b' },
            { value: 'a' },
            { removed: true, value: 'n' },
            { added: true, value: 't' },
            { value: 'ana' },
          ]
        )

        assert.deepStrictEqual(
          diff(
            'apple',
            'apply' // replace e with y (2 edits)
          ),
          [
            { value: 'appl' },
            { removed: true, value: 'e' },
            { added: true, value: 'y' },
          ]
        )

        assert.deepStrictEqual(
          diff('ABCABBA', 'CBABAC'),
          [
            { removed: true, value: 'AB' },
            { value: 'C' },
            { added: true, value: 'B' },
            { value: 'AB' },
            { removed: true, value: 'B' },
            { value: 'A' },
            { added: true, value: 'C' }
          ]
        )

    })

     test('should correctly handle case where addition path is initially shorter but better', () => {
        assert.deepStrictEqual(
          diff('ac', 'ba'),
          [
            { added: true, value: 'b' },
            { value: 'a' },
            { removed: true, value: 'c' },
          ]
        )
     })
  })

  describe('Unicode and Special Characters', () => {
    test('should handle basic unicode characters', () => {
      assert.deepStrictEqual(
        diff(
          'abcαβγdef',
          'abcδεζdef'
        ),
        [
          { value: 'abc' },
          { removed: true, value: 'αβγ' },
          { added: true, value: 'δεζ' },
          { value: 'def' }
        ]
      )
    })

     test('should handle multi-byte unicode characters (e.g., emoji)', () => {
        assert.deepStrictEqual(
          diff('Hello 👋 World', 'Hello 🎉 World'),
          [
            { value: 'Hello ' },
            { removed: true, value: '👋' },
            { added: true, value: '🎉' },
            { value: ' World' }
          ]
        )
     })

     test('should handle strings with spaces and punctuation', () => {
         assert.deepStrictEqual(
          diff(
            'Test string, with punctuation!',
            'Test string; without that punctuation?'
          ),
          [
            { value: 'Test string' },
            { removed: true, value: ',' }, { added: true, value: ';' },
            { value: ' with' },
            { added: true, value: 'out'},
            { value: ' ' },
            { added: true, value: 'that '},
            { value: 'punctuation' },
            { removed: true, value: '!' }, { added: true, value: '?' },
          ]
        )
     })

     test('should handle different line endings correctly', () => {
      assert.deepStrictEqual(
        diff(
          'line1\nline2',
          'line1\r\nline2'
        ),
        [
          { value: 'line1' },
          { added: true, value: '\r' },
          { value: '\nline2' },
        ]
      )
    })
  })
})
