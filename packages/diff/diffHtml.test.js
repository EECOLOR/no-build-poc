import assert from 'node:assert'
import { describe, test } from 'node:test'
import { diffHtml, toHtml } from './diffHtml.js'

const hasText = true
const hasTags = true
const added = true
const removed = true
const contextChanged = true
const hasUnclosedOpenTags = true
const hasUnopenedCloseTags = true

function ins(str) {
  return `<ins class="diff-added">${str}</ins>`
}
function del(str) {
  return `<del class="diff-removed">${str}</del>`
}
function span(str) {
  return `<span class="diff-context-changed">${str}</span>`
}

describe('diffHtml', () => {

  describe('Basic Cases', () => {
    test('should return array of parts for identical inputs', () => {
      testDiff(
        'abc', 'abc',
        [{ value: 'abc', hasText }],
        `abc`
      )
      testDiff(
        '', '',
        [],
        ``
      )
      testDiff(
        '<b>abc</b>', '<b>abc</b>',
        [{ value: '<b>abc</b>', hasTags, hasText }],
        '<b>abc</b>',
      )
    })

    test('should handle empty old value', () => {
      testDiff(
        '', 'abc',
        [{ value: 'abc', added, hasText }],
        ins('abc')
      )
      testDiff(
        '', '<b>abc</b>',
        [{ value: '<b>abc</b>', added, hasTags, hasText }],
        `<b>${ins('abc')}</b>`
      )
    })

    test('should handle empty new value', () => {
      testDiff(
        'abc', '',
        [{ value: 'abc', removed, hasText }],
        del('abc')
      )
      testDiff(
        '<b>abc</b>', '',
        [{ value: '<b>abc</b>', removed, hasTags, hasText }],
        del('<b>abc</b>')
      )
    })

    test('should handle input containing only tags', () => {
       testDiff(
        '<b></b>', '<i></i>',
         [
           { value: '<b></b>', removed, hasTags },
           { value: '<i></i>', added, hasTags }
         ],
         '<i></i>'
      )
      testDiff(
        '<b></b>', '',
        [{ value: '<b></b>', removed, hasTags }],
        '',
      )
      testDiff(
        '', '<b></b>',
        [{ value: '<b></b>', added, hasTags }],
        '<b></b>',
      )
    })
  })

  describe('Text-Only Changes', () => {
    test('should handle simple text addition', () => {
      testDiff(
        'abc', 'abcd',
        [
          { value: 'abc', hasText },
          { value: 'd', added, hasText }
        ],
        `abc${ins('d')}`
      )
    })

    test('should handle simple text deletion', () => {
      testDiff(
        'abcd', 'abc',
        [
          { value: 'abc', hasText },
          { value: 'd', removed, hasText }
        ],
        `abc${del('d')}`
      )
    })

    describe('Simple Text Modification', () => {
      test('should handle simple text modification (merged)', () => {
        testDiff(
          'abc', 'axc',
          [
            { value: 'abc', removed, hasText },
            { value: 'axc', added, hasText }
          ],
          `${del('abc')}${ins('axc')}`
        )
      })

      test('should handle simple text modification (not merged)', () => {
        testDiff(
          'abcdefg', 'abcxefg',
          [
            { value: 'abc', hasText },
            { value: 'd', removed, hasText },
            { value: 'x', added, hasText },
            { value: 'efg', hasText }
          ],
          `abc${del('d')}${ins('x')}efg`
        )
      })
    })

    describe('Changes at the Beginning', () => {
      test('should handle addition at the beginning', () => {
        testDiff(
          'abc', 'xabc',
          [
            { value: 'x', added, hasText },
            { value: 'abc', hasText }
          ],
          `${ins('x')}abc`
        )
      })

      test('should handle deletion at the beginning', () => {
        testDiff(
          'xabc', 'abc',
          [
            { value: 'x', removed, hasText },
            { value: 'abc', hasText }
          ],
          `${del('x')}abc`
        )
      })

      test('should handle modification at the beginning (merged)', () => {
        testDiff(
          'abc', 'xbc',
          [
            { value: 'abc', removed, hasText },
            { value: 'xbc', added, hasText }
          ],
          `${del('abc')}${ins('xbc')}`
        )
      })

      test('should handle modification at the beginning (not merged)', () => {
        testDiff(
          'abcd', 'xbcd',
          [
            { value: 'a', removed, hasText },
            { value: 'x', added, hasText },
            { value: 'bcd', hasText }
          ],
          `${del('a')}${ins('x')}bcd`
        )
      })
    })

    describe('Changes at the End', () => {
      test('should handle addition at the end', () => {
        testDiff(
          'abc', 'abcx',
          [
            { value: 'abc', hasText },
            { value: 'x', added, hasText }
          ],
          `abc${ins('x')}`
        )
      })

      test('should handle deletion at the end', () => {
        testDiff(
          'abcx', 'abc',
          [
            { value: 'abc', hasText },
            { value: 'x', removed, hasText }
          ],
          `abc${del('x')}`
        )
      })

      test('should handle modification at the end (merged)', () => {
        testDiff(
          'abc', 'abx',
          [
            { value: 'abc', removed, hasText },
            { value: 'abx', added, hasText }
          ],
          `${del('abc')}${ins('abx')}`
        )
      })

      test('should handle modification at the end (not merged)', () => {
        testDiff(
          'abcd', 'abcx',
          [
            { value: 'abc', hasText },
            { value: 'd', removed, hasText },
            { value: 'x', added, hasText }
          ],
          `abc${del('d')}${ins('x')}`
        )
      })
    })

    test('should handle complete text replacement', () => {
      testDiff(
        'abc', 'xyz',
        [
          { value: 'abc', removed, hasText },
          { value: 'xyz', added, hasText }
        ],
        `${del('abc')}${ins('xyz')}`
      )
    })

    test('should handle HTML entity changes', () => {
      testDiff(
        'a &amp; b', 'a and b',
        [
          { value: 'a &amp; b', removed, hasText },
          { value: 'a and b', added, hasText },
        ],
        `${del('a &amp; b')}${ins('a and b')}`
      )
      testDiff(
        'Price: &euro;10', 'Price: &pound;10',
        [
          { value: 'Price: &', hasText },
          { value: 'euro', removed, hasText },
          { value: 'pound', added, hasText },
          { value: ';10', hasText }
        ],
        `Price: &${del('euro')}${ins('pound')};10`
      )
    })
  })

  describe('Tag Operations', () => {
    describe('Adding Tags', () => {
      test('should handle adding only tags (merged)', () => {
        testDiff(
          'abc', 'a<b>b</b>c',
          [
            { value: 'abc', removed, hasText },
            { value: 'a<b>b</b>c', added, hasTags, hasText }
          ],
          `${del('abc')}${ins('a')}<b>${ins('b')}</b>${ins('c')}`
        )
      })

      test('should handle adding only tags (not merged)', () => {
        testDiff(
          'abcdefghi', 'abc<b>def</b>ghi',
          [
            { value: 'abc', hasText },
            { value: '<b>', added, hasTags, hasUnclosedOpenTags },
            { value: 'def', contextChanged, hasText },
            { value: '</b>', added, hasTags, hasUnopenedCloseTags },
            { value: 'ghi', hasText }
          ],
          `abc<b>${span('def')}</b>ghi`
        )
      })

      test('should handle adding tags around existing text (merged)', () => {
        testDiff(
          'ab', '<b>ab</b>',
          [
            { value: 'ab', removed, hasText },
            { value: '<b>ab</b>', added, hasTags, hasText }
          ],
          `${del('ab')}<b>${ins('ab')}</b>`
        )
      })

      test('should handle adding tags around existing text (not merged)', () => {
        testDiff(
          'abc', '<b>abc</b>',
          [
            { value: '<b>', added, hasTags, hasUnclosedOpenTags },
            { value: 'abc', contextChanged, hasText },
            { value: '</b>', added, hasTags, hasUnopenedCloseTags }
          ],
          `<b>${span('abc')}</b>`
        )
      })

      test('should handle adding empty tags', () => {
         testDiff(
          'abc def', 'abc <b></b> def',
          [
            { value: 'abc ', hasText },
            { value: '<b></b> ', added, hasTags, hasText },
            { value: 'def', hasText }
          ],
          `abc <b></b>${ins(' ')}def`
        )
      })
    })

    describe('Removing Tags', () => {
      test('should handle removing only tags (merged)', () => {
        testDiff(
          'a<b>b</b>c', 'abc',
          [
            { value: 'a<b>b</b>c', removed, hasTags, hasText },
            { value: 'abc', added, hasText }
          ],
          `${del('a<b>b</b>c')}${ins('abc')}`
        )
      })

      test('should handle removing only tags (not merged)', () => {
        testDiff(
          'abc<b>def</b>ghi', 'abcdefghi',
          [
            { value: 'abc', hasText },
            { value: '<b>', removed, hasTags, hasUnclosedOpenTags },
            { value: 'def', contextChanged, hasText },
            { value: '</b>', removed, hasTags, hasUnopenedCloseTags },
            { value: 'ghi', hasText }
          ],
          `abc${span('def')}ghi`
        )
      })

      test('should handle removing only tags with attributes (merged)', () => {
        testDiff(
          'a<b class="foo">b</b>c', 'abc',
          [
            { value: 'a<b class="foo">b</b>c', removed, hasTags, hasText },
            { value: 'abc', added, hasText }
          ],
          `${del('a<b class="foo">b</b>c')}${ins('abc')}`
        )
      })

      test('should handle removing only tags with attributes (not merged)', () => {
        testDiff(
          'abc<b class="foo">def</b>ghi', 'abcdefghi',
          [
            { value: 'abc', hasText },
            { value: '<b class="foo">', removed, hasTags, hasUnclosedOpenTags },
            { value: 'def', contextChanged, hasText },
            { value: '</b>', removed, hasTags, hasUnopenedCloseTags },
            { value: 'ghi', hasText }
          ],
          `abc${span('def')}ghi`
        )
      })

      test('should handle removing tags from around existing text', () => {
        testDiff(
          '<b>abc</b>', 'abc',
          [
            { value: '<b>', removed, hasTags, hasUnclosedOpenTags },
            { value: 'abc', contextChanged, hasText },
            { value: '</b>', removed, hasTags, hasUnopenedCloseTags },
          ],
          span('abc')
        )
      })

      test('should handle removing empty tags', () => {
        testDiff(
          'abc <b></b> def', 'abc  def',
          [
            { value: 'abc ', hasText },
            { value: '<b></b>', removed, hasTags },
            { value: ' def', hasText }
          ],
          `abc  def`
        )
        testDiff(
          'abc <p></p> def', 'abc def',
          [
            { value: 'abc ', hasText },
            { value: '<p></p> ', removed, hasTags, hasText },
            { value: 'def', hasText }
          ],
          `abc ${del('<p></p> ')}def`
        )
      })
    })

    describe('Changing Tags', () => {
      test('should handle changing only tags (merged)', () => {
        testDiff(
          '<b>ab</b>', '<i>ab</i>',
          [
            { value: '<b>ab</b>', removed, hasTags, hasText },
            { value: '<i>ab</i>', added, hasTags, hasText }
          ],
          `${del('<b>ab</b>')}<i>${ins('ab')}</i>`
        )
      })

      test('should handle changing only tags (not merged)', () => {
        testDiff(
          '<b>abc</b>', '<i>abc</i>',
          [
            { value: '<b>', removed, hasTags, hasUnclosedOpenTags },
            { value: '<i>', added, hasTags, hasUnclosedOpenTags },
            { value: 'abc', contextChanged, hasText },
            { value: '</b>', removed, hasTags, hasUnopenedCloseTags },
            { value: '</i>', added, hasTags, hasUnopenedCloseTags },
          ],
          `<i>${span('abc')}</i>`
        )
      })
    })

    describe('Case Sensitivity', () => {
      test('should handle tag case changes (assuming literal diff)', () => {
        testDiff(
          '<b>text</b>', '<B>text</B>',
          [
            { value: '<b>', removed, hasTags, hasUnclosedOpenTags },
            { value: '<B>', added, hasTags, hasUnclosedOpenTags },
            { value: 'text', contextChanged, hasText },
            { value: '</b>', removed, hasTags, hasUnopenedCloseTags },
            { value: '</B>', added, hasTags, hasUnopenedCloseTags },
          ],
          `<B>${span('text')}</B>`
         )
      })

      test('should handle attribute name case changes (assuming literal diff)', () => {
        testDiff(
          '<b class="foo">text</b>', '<b CLASS="foo">text</b>',
           [
             { value: '<b class="foo">', removed, hasTags, hasUnclosedOpenTags },
             { value: '<b CLASS="foo">', added, hasTags, hasUnclosedOpenTags },
             { value: 'text</b>', contextChanged, hasText, hasTags, hasUnopenedCloseTags },
           ],
           `<b CLASS="foo">${span('text')}</b>`
         )
      })
    })
  })

  describe('Combined Text and Tag Changes', () => {
    test('should handle adding text within existing tags', () => {
      testDiff(
        '<b>abc</b>', '<b>axbc</b>',
        [
          { value: '<b>a', hasTags, hasText, hasUnclosedOpenTags },
          { value: 'x', added, hasText },
          { value: 'bc</b>', hasTags, hasText, hasUnopenedCloseTags }
        ],
        `<b>a${ins('x')}bc</b>`
      )
    })

    test('should handle removing text within existing tags', () => {
      testDiff(
        '<b>abc</b>', '<b>ac</b>',
        [
          { value: '<b>a', hasTags, hasText, hasUnclosedOpenTags },
          { value: 'b', removed, hasText },
          { value: 'c</b>', hasTags, hasText, hasUnopenedCloseTags }
        ],
        `<b>a${del('b')}c</b>`
      )
    })

    test('should handle modifying text within existing tags', () => {
      testDiff(
        '<b>abc</b>', '<b>axc</b>',
        [
          { value: '<b>a', hasTags, hasText, hasUnclosedOpenTags },
          { value: 'b', removed, hasText },
          { value: 'x', added, hasText },
          { value: 'c</b>', hasTags, hasText, hasUnopenedCloseTags }
        ],
        `<b>a${del('b')}${ins('x')}c</b>`
      )
    })

    test('should handle complex changes involving text and tags', () => {
      testDiff(
        'a <b>bold</b> text',
        'a <i>italic</i> text now',
        [
          { value: 'a <b>bold</b>', removed, hasTags, hasText },
          { value: 'a <i>italic</i>', added, hasTags, hasText },
          { value: ' text', hasText },
          { value: ' now', added, hasText }
        ],
        `${del('a <b>bold</b>')}${ins('a ')}<i>${ins('italic')}</i> text${ins(' now')}`
      )
    })

    test('should handle multiple combined changes effectively', () => {
      testDiff(
        '<p class="old">Hello <b>world</b>!</p>',
        '<div class="new"><span>Hello</span> there! <hr/></div>',
        [
           { value: '<p class="old">', removed, hasTags, hasUnclosedOpenTags },
           { value: '<div class="new"><span>', added, hasTags, hasUnclosedOpenTags },
           { value: 'Hello', contextChanged, hasText },
           { value: ' <b>world</b>!</p>', removed, hasTags, hasText, hasUnopenedCloseTags },
           { value: '</span> there! <hr/></div>', added, hasTags, hasText, hasUnopenedCloseTags },
        ],
        `<div class="new"><span>${span('Hello')}${del(' <b>world</b>!')}</span>${ins(' there! ')}<hr/></div>`
      )
    })
  })

  describe('Attributes', () => {
    test('should handle tags with attributes correctly', () => {
      testDiff(
        '<b class="foo">abc</b>',
        '<i id="bar">abc</i>',
        [
          { value: '<b class="foo">', removed, hasTags, hasUnclosedOpenTags },
          { value: '<i id="bar">', added, hasTags, hasUnclosedOpenTags },
          { value: 'abc', contextChanged, hasText },
          { value: '</b>', removed, hasTags, hasUnopenedCloseTags },
          { value: '</i>', added, hasTags, hasUnopenedCloseTags },
        ],
        `<i id="bar">${span('abc')}</i>`
      )

      testDiff(
        '<b class="foo">abc</b>',
        '<b class="bar">abc</b>',
        [
          { value: '<b class="foo">', removed, hasTags, hasUnclosedOpenTags },
          { value: '<b class="bar">', added, hasTags, hasUnclosedOpenTags },
          { value: 'abc</b>', contextChanged, hasText, hasTags, hasUnopenedCloseTags },
        ],
        `<b class="bar">${span('abc')}</b>`
      )

      testDiff(
        '<b class="foo">abc</b>',
        '<b class="FOO">abc</b>',
        [
          { value: '<b class="foo">', removed, hasTags, hasUnclosedOpenTags },
          { value: '<b class="FOO">', added, hasTags, hasUnclosedOpenTags },
          { value: 'abc</b>', contextChanged, hasText, hasTags, hasUnopenedCloseTags },
        ],
        `<b class="FOO">${span('abc')}</b>`
      )
    })

    test('should handle adding an attribute', () => {
      testDiff(
        '<b>text</b>',
        '<b class="foo">text</b>',
        [
          { value: '<b>', removed, hasTags, hasUnclosedOpenTags },
          { value: '<b class="foo">', added, hasTags, hasUnclosedOpenTags },
          { value: 'text</b>', contextChanged, hasText, hasTags, hasUnopenedCloseTags },
        ],
        `<b class="foo">${span('text')}</b>`
      )
    })

    test('should handle removing an attribute', () => {
      testDiff(
        '<b class="foo">text</b>',
        '<b>text</b>',
        [
          { value: '<b class="foo">', removed, hasTags, hasUnclosedOpenTags },
          { value: '<b>', added, hasTags, hasUnclosedOpenTags },
          { value: 'text</b>', contextChanged, hasText, hasTags, hasUnopenedCloseTags },
        ],
        `<b>${span('text')}</b>`
      )
    })

    test('should handle changing attribute value when multiple attributes exist', () => {
      testDiff(
        '<b class="foo" id="x">text</b>',
        '<b class="bar" id="x">text</b>',
        [
          { value: '<b class="foo" id="x">', removed, hasTags, hasUnclosedOpenTags },
          { value: '<b class="bar" id="x">', added, hasTags, hasUnclosedOpenTags },
          { value: 'text</b>', contextChanged, hasText, hasTags, hasUnopenedCloseTags },
        ],
        `<b class="bar" id="x">${span('text')}</b>`
      )
    })

    test('should handle removing an attribute when multiple attributes exist', () => {
      testDiff(
        '<b class="foo" id="x">text</b>',
        '<b class="foo">text</b>',
        [
          { value: '<b class="foo" id="x">', removed, hasTags, hasUnclosedOpenTags },
          { value: '<b class="foo">', added, hasTags, hasUnclosedOpenTags },
          { value: 'text</b>', contextChanged, hasText, hasTags, hasUnopenedCloseTags },
        ],
        `<b class="foo">${span('text')}</b>`
      )
    })

    test('should handle adding an attribute when multiple attributes exist', () => {
      testDiff(
        '<b class="foo">text</b>',
        '<b class="foo" id="x">text</b>',
        [
          { value: '<b class="foo">', removed, hasTags, hasUnclosedOpenTags },
          { value: '<b class="foo" id="x">', added, hasTags, hasUnclosedOpenTags },
          { value: 'text</b>', contextChanged, hasText, hasTags, hasUnopenedCloseTags },
        ],
        `<b class="foo" id="x">${span('text')}</b>`
      )
    })

    test('should handle attribute order changes (assuming literal diff)', () => {
      testDiff(
        '<b class="foo" id="x">text</b>',
        '<b id="x" class="foo">text</b>',
        [
          { value: '<b class="foo" id="x">', removed, hasTags, hasUnclosedOpenTags },
          { value: '<b id="x" class="foo">', added, hasTags, hasUnclosedOpenTags },
          { value: 'text</b>', contextChanged, hasText, hasTags, hasUnopenedCloseTags },
        ],
        `<b id="x" class="foo">${span('text')}</b>`
      )
    })

    test('should handle attribute changes on self-closing tags', () => {
      testDiff(
        'text <hr class="a"/> more',
        'text <hr class="b"/> more',
        [
          { value: 'text ', hasText },
          { value: '<hr class="a"/>', removed, hasTags },
          { value: '<hr class="b"/>', added, hasTags },
          { value: ' more', hasText }
        ],
        `text <hr class="b"/> more`
      )

      testDiff(
        'image <img src="a.jpg"/>',
        'image <img src="a.jpg" alt="A"/>',
        [
          { value: 'image ', hasText },
          { value: '<img src="a.jpg"/>', removed, hasTags },
          { value: '<img src="a.jpg" alt="A"/>', added, hasTags },
        ],
        `image <img src="a.jpg" alt="A"/>`
      )

      testDiff(
        'image <img src="a.jpg" alt="A"/>',
        'image <img src="a.jpg"/>',
        [
          { value: 'image ', hasText },
          { value: '<img src="a.jpg" alt="A"/>', removed, hasTags },
          { value: '<img src="a.jpg"/>', added, hasTags },
        ],
        `image <img src="a.jpg"/>`
      )
    })

    test('should handle HTML entity changes in attributes', () => {
       testDiff(
        '<a href="?a=1&amp;b=2">link</a>',
        '<a href="?a=1&amp;c=3">link</a>',
         [
           { value: '<a href="?a=1&amp;b=2">', removed, hasTags, hasUnclosedOpenTags },
           { value: '<a href="?a=1&amp;c=3">', added, hasTags, hasUnclosedOpenTags },
           { value: 'link</a>', contextChanged, hasText, hasTags, hasUnopenedCloseTags },
         ],
         `<a href="?a=1&amp;c=3">${span('link')}</a>`
       )

       testDiff(
        '<a title="a &amp; b">link</a>',
        '<a title="a & b">link</a>',
         [
           { value: '<a title="a &amp; b">', removed, hasTags, hasUnclosedOpenTags },
           { value: '<a title="a & b">', added, hasTags, hasUnclosedOpenTags },
           { value: 'link</a>', contextChanged, hasText, hasTags, hasUnopenedCloseTags },
         ],
         `<a title="a & b">${span('link')}</a>`
       )
    })
  })

  describe('Whitespace Handling', () => {
    test('should handle leading/trailing whitespace changes within tags', () => {
      testDiff(
        '<b> abc</b>',
        '<b>abc </b>',
        [
          { value: '<b>', hasTags, hasUnclosedOpenTags },
          { value: ' ', removed, hasText },
          { value: 'abc', hasText },
          { value: ' ', added, hasText },
          { value: '</b>', hasTags, hasUnopenedCloseTags },
        ],
        `<b>${del(' ')}abc${ins(' ')}</b>`
      )
    })

    describe('Whitespace-only text node changes', () => {
      test('should handle whitespace-only text node changes (merged)', () => { // Note: .only preserved
        testDiff(
          '<b> </b>',
          '<i> </i>',
          [
            { value: '<b> </b>', removed, hasTags, hasText },
            { value: '<i> </i>', added, hasTags, hasText },
          ],
          `${del('<b> </b>')}<i>${ins(' ')}</i>`
        )
      })

      test('should handle whitespace-only text node changes (not merged)', () => {
        testDiff(
          '<b>   </b>',
          '<i>   </i>',
          [
            { value: '<b>', removed, hasTags, hasUnclosedOpenTags },
            { value: '<i>', added, hasTags, hasUnclosedOpenTags },
            { value: '   ', contextChanged, hasText },
            { value: '</b>', removed, hasTags, hasUnopenedCloseTags },
            { value: '</i>', added, hasTags, hasUnopenedCloseTags },
          ],
          `<i>${span('   ')}</i>`
        )
        testDiff(
          'abc <b>   </b> def',
          'abc <b> --- </b> def',
           [
             { value: 'abc <b> ', hasTags, hasText, hasUnclosedOpenTags },
             { value: ' ', removed, hasText },
             { value: '---', added, hasText },
             { value: ' </b> def', hasTags, hasText, hasUnopenedCloseTags },
           ],
           `abc <b> ${del(' ')}${ins('---')} </b> def`
         )
      })
    })


    test('should handle whitespace between tags', () => {
      testDiff(
        '<b>abc</b> <i>de</i>',
        '<b>abc</b> <u>de</u>',
        [
          { value: '<b>abc</b> ', hasTags, hasText },
          { value: '<i>de</i>', removed, hasTags, hasText },
          { value: '<u>de</u>', added, hasTags, hasText },
        ],
        `<b>abc</b> ${del('<i>de</i>')}<u>${ins('de')}</u>`
      )

      testDiff(
        '<b>abc</b><i>def</i>',
        '<b>abc</b> <i>def</i>',
        [
          { value: '<b>abc</b>', hasTags, hasText },
          { value: ' ', added, hasText },
          { value: '<i>def</i>', hasTags, hasText },
        ],
        `<b>abc</b>${ins(' ')}<i>def</i>`
      )

      testDiff(
        '<b>a</b> <i>b</i>',
        '<b>a</b>   <i>b</i>',
         [
           { value: '<b>a</b> ', hasTags, hasText },
           { value: '  ', added, hasText },
           { value: '<i>b</i>', hasTags, hasText },
         ],
         `<b>a</b> ${ins('  ')}<i>b</i>`
       )

      testDiff(
        '<b>a</b> <i>b</i>',
        '<b>a</b><i>b</i>',
        [
          { value: '<b>a</b>', hasTags, hasText },
          { value: ' ', removed, hasText },
          { value: '<i>b</i>', hasTags, hasText },
        ],
        `<b>a</b>${del(' ')}<i>b</i>`
      )
    })

    test('should correctly handle context changes involving whitespace', () => {
      testDiff(
        '<b>  abc  </b>',
        '<i>  abc  </i>',
        [
          { value: '<b>', removed, hasTags, hasUnclosedOpenTags },
          { value: '<i>', added, hasTags, hasUnclosedOpenTags },
          { value: '  abc  ', contextChanged, hasText },
          { value: '</b>', removed, hasTags, hasUnopenedCloseTags },
          { value: '</i>', added, hasTags, hasUnopenedCloseTags },
        ],
        `<i>${span('  abc  ')}</i>`
      )

      testDiff(
        '<b>abc</b>',
        '<i> abc </i>',
        [
          { value: '<b>', removed, hasTags, hasUnclosedOpenTags },
          { value: '<i> ', added, hasTags, hasText, hasUnclosedOpenTags },
          { value: 'abc', contextChanged, hasText },
          { value: '</b>', removed, hasTags, hasUnopenedCloseTags },
          { value: ' </i>', added, hasTags, hasText, hasUnopenedCloseTags },
        ],
        `<i>${ins(' ')}${span('abc')}${ins(' ')}</i>`
      )

      testDiff(
        '<b><u>abc</u></b>',
        '<i><em> abc </em></i>',
        [
          { value: '<b><u>', removed, hasTags, hasUnclosedOpenTags },
          { value: '<i><em> ', added, hasTags, hasText, hasUnclosedOpenTags },
          { value: 'abc', contextChanged, hasText },
          { value: '</u></b>', removed, hasTags, hasUnopenedCloseTags },
          { value: ' </em></i>', added, hasTags, hasText, hasUnopenedCloseTags },
        ],
        `<i><em>${ins(' ')}${span('abc')}${ins(' ')}</em></i>`
      )

      testDiff(
        '<b> abc </b>',
        '<i> def </i>',
        [
          { value: '<b> abc </b>', removed, hasTags, hasText },
          { value: '<i> def </i>', added, hasTags, hasText },
        ],
        `${del('<b> abc </b>')}<i>${ins(' def ')}</i>`
      )

      testDiff(
        '<b>   abc   </b>',
        '<i>   def   </i>',
        [
          { value: '<b>', removed, hasTags, hasUnclosedOpenTags },
          { value: '<i>', added, hasTags, hasUnclosedOpenTags },
          { value: '   ', hasText, contextChanged },
          { value: 'abc', removed, hasText },
          { value: 'def', added, hasText },
          { value: '   ', hasText, contextChanged },
          { value: '</b>', removed, hasTags, hasUnopenedCloseTags },
          { value: '</i>', added, hasTags, hasUnopenedCloseTags },
        ],
        `<i>${span('   ')}${del('abc')}${ins('def')}${span('   ')}</i>`
      )
    })
  })

  describe('Nesting', () => {
    test('should handle nested tag changes correctly', () => {
      testDiff(
        '<b>bold <i>italic</i></b>',
        '<u>underline <i>italic</i> maybe</u>',
        [
          { value: '<b>bold', removed, hasTags, hasText, hasUnclosedOpenTags },
          { value: '<u>underline', added, hasTags, hasText, hasUnclosedOpenTags },
          { value: ' <i>italic</i>', contextChanged, hasTags, hasText },
          { value: '</b>', removed, hasTags, hasUnopenedCloseTags },
          { value: ' maybe</u>', added, hasTags, hasText, hasUnopenedCloseTags }
        ],
        `${del('bold')}<u>${ins('underline')}${span(' ')}<i>${span('italic')}</i>${ins(' maybe')}</u>`
        // TODO: we might want to add the `</b>` to the deleted section. With structural tags this is probably undesirable
        // `${del('<b>bold</b>')}<u>${ins('underline')}${span(' ')}<i>${span('italic')}</i>${ins(' maybe')}</u>`
      )
    })

    test('should handle adding nesting level', () => {
      testDiff(
        '<b>text</b>',
        '<b><i>text</i></b>',
        [
          { value: '<b>', hasTags, hasUnclosedOpenTags },
          { value: '<i>', added, hasTags, hasUnclosedOpenTags },
          { value: 'text', hasText, contextChanged },
          { value: '</i>', added, hasTags, hasUnopenedCloseTags },
          { value: '</b>', hasTags, hasUnopenedCloseTags }
        ],
        `<b><i>${span('text')}</i></b>`
      )
    })

    test('should handle removing nesting level', () => {
      testDiff(
        '<b><i>text</i></b>',
        '<b>text</b>',
        [
          { value: '<b>', hasTags, hasUnclosedOpenTags },
          { value: '<i>', removed, hasTags, hasUnclosedOpenTags },
          { value: 'text', hasText, contextChanged },
          { value: '</i>', removed, hasTags, hasUnopenedCloseTags },
          { value: '</b>', hasTags, hasUnopenedCloseTags }
        ],
        `<b>${span('text')}</b>`
      )
    })

    test('should handle changes deep inside nested structure', () => {
      testDiff(
        '<div><p>keep <b>change</b> this</p></div>',
        '<div><p>keep <i>replace</i> this</p></div>',
        [
          { value: '<div><p>keep ', hasTags, hasText, hasUnclosedOpenTags },
          { value: '<b>change</b>', removed, hasTags, hasText },
          { value: '<i>replace</i>', added, hasTags, hasText },
          { value: ' this</p></div>', hasTags, hasText, hasUnopenedCloseTags }
        ],
        `<div><p>keep ${del('<b>change</b>')}<i>${ins('replace')}</i> this</p></div>`
      )
    })

    test('should correctly balance difference in lists', () => {
      testDiff(
        '<ul><li><p>item 1</p></li><li><p>item 2</p></li><li><p>item 3</p></li></ul><p>outside</p>',
        '<ul><li><p>item 1</p></li><li><p>item 3</p></li></ul><p>outside</p>',
        [
          { value: '<ul><li><p>item 1</p></li>', hasTags, hasText, hasUnclosedOpenTags },
          { value: '<li><p>item 2</p></li>', removed, hasTags, hasText },
          { value: '<li><p>item 3</p></li></ul><p>outside</p>', hasTags, hasText, hasUnopenedCloseTags }
        ],
        `<ul><li><p>item 1</p></li>${del('<li><p>item 2</p></li>')}<li><p>item 3</p></li></ul><p>outside</p>`
      )
    })

    test('should balance to the "left" on remove', () => {
      testDiff(
        'item 1<p>item 2</p><p>item 3</p>',
        'item 1<p>item 3</p>',
        [
          { value: 'item 1', hasText },
          { value: '<p>item 2</p>', removed, hasTags, hasText },
          { value: '<p>item 3</p>', hasTags, hasText }
        ],
        `item 1${del('<p>item 2</p>')}<p>item 3</p>`
      )
    })

    test('should balance to the "left" and discard empty on remove', () => {
      testDiff(
        '<p>item 2</p><p>item 3</p>',
        '<p>item 3</p>',
        [
          { value: '<p>item 2</p>', removed, hasTags, hasText },
          { value: '<p>item 3</p>', hasTags, hasText }
        ],
        `${del('<p>item 2</p>')}<p>item 3</p>`
      )
    })

    test('should balance to the "left" on add', () => {
      testDiff(
        'item 1<p>item 3</p>',
        'item 1<p>item 2</p><p>item 3</p>',
        [
          { value: 'item 1', hasText },
          { value: '<p>item 2</p>', added, hasTags, hasText },
          { value: '<p>item 3</p>', hasTags, hasText }
        ],
        `item 1<p>${ins('item 2')}</p><p>item 3</p>`
      )
    })

    test('should balance to the "left" and discard empty on add', () => {
      testDiff(
        '<p>item 3</p>',
        '<p>item 2</p><p>item 3</p>',
        [
          { value: '<p>item 2</p>', added, hasTags, hasText },
          { value: '<p>item 3</p>', hasTags, hasText }
        ],
        `<p>${ins('item 2')}</p><p>item 3</p>`
      )
    })

    test('should balance to the "right"', () => {
      testDiff(
        'item abc<p>item def</p>',
        'item abc<p><i>item</i> def</p><p>item 3</p>',
        [
          { value: 'item abc<p>', hasText, hasTags, hasUnclosedOpenTags },
          { value: '<i>', added, hasTags, hasUnclosedOpenTags },
          { value: 'item', contextChanged, hasText },
          { value: '</i>', added, hasTags, hasUnopenedCloseTags },
          { value: ' def</p>', hasTags, hasText, hasUnopenedCloseTags },
          { value: '<p>item 3</p>', added, hasTags, hasText }
        ],
        `item abc<p><i>${span('item')}</i> def</p><p>${ins('item 3')}</p>`
      )
    })
  })

  describe('Self-Closing Tags', () => {
    test('should handle self-closing tags changes', () => {
      testDiff(
        'text <br/> more',
        'text <hr/> more',
        [
          { value: 'text ', hasText },
          { value: '<br/>', removed, hasTags },
          { value: '<hr/>', added, hasTags },
          { value: ' more', hasText }
        ],
        `text <hr/> more`
      )

      testDiff(
        'text <br/> more',
        'text more',
        [
          { value: 'text ', hasText },
          { value: '<br/> ', removed, hasTags, hasText },
          { value: 'more', hasText }
        ],
        `text ${del(' ')}more`
        // TODO: we might want this:
        // `text ${del('<br /> ')}more`
      )

      testDiff(
        'text more',
        'text <br/> more',
        [
          { value: 'text ', hasText },
          { value: '<br/> ', added, hasTags, hasText },
          { value: 'more', hasText }
        ],
        `text <br/>${ins(' ')}more`
      )
    })

    test('should handle self-closing tag syntax variations (assuming literal diff)', () => {
      testDiff(
        'text <br/> more',
        'text <br> more',
        [
          { value: 'text ', hasText },
          { value: '<br/>', removed, hasTags },
          { value: '<br>', added, hasTags, hasUnclosedOpenTags },
          { value: ' more', hasText, contextChanged }
        ],
        `text <br>${span(' more')}`
      )
      testDiff(
        'text <br> more',
        'text <br/> more',
        [
          { value: 'text ', hasText },
          { value: '<br>', removed, hasTags, hasUnclosedOpenTags },
          { value: '<br/>', added, hasTags },
          { value: ' more', hasText, contextChanged }
        ],
        `text <br/>${span(' more')}`
      )
    })

    describe('Adding tag-only parts (like <br/>)', () => {
      test('should handle adding tag-only parts (merged)', () => {
        testDiff(
          'a b',
          'a <br/> b',
          [
            { value: 'a b', removed, hasText },
            { value: 'a <br/> b', added, hasTags, hasText }
          ],
          `${del('a b')}${ins('a ')}<br/>${ins(' b')}`
        )
      })

      test('should handle adding tag-only parts (not merged)', () => {
        testDiff(
          'abc def',
          'abc <br/> def',
          [
            { value: 'abc ', hasText },
            { value: '<br/> ', added, hasTags, hasText },
            { value: 'def', hasText }
          ],
          `abc <br/>${ins(' ')}def`
        )
      })
    })
  })

  describe('Context Change Flag', () => {
    test('should mark unchanged text following tag changes as context changed', () => {
      testDiff(
        '<b> a </b> b <i> c </i>',
        '<u> a </u> b <em> c </em>',
        [
          { value: '<b>', removed, hasTags, hasUnclosedOpenTags },
          { value: '<u>', added, hasTags, hasUnclosedOpenTags },
          { value: ' a ', contextChanged, hasText },
          { value: '</b>', removed, hasTags, hasUnopenedCloseTags },
          { value: '</u>', added, hasTags, hasUnopenedCloseTags },
          { value: ' b ', hasText },
          { value: '<i>', removed, hasTags, hasUnclosedOpenTags },
          { value: '<em>', added, hasTags, hasUnclosedOpenTags },
          { value: ' c ', contextChanged, hasText },
          { value: '</i>', removed, hasTags, hasUnopenedCloseTags },
          { value: '</em>', added, hasTags, hasUnopenedCloseTags },
        ],
        `<u>${span(' a ')}</u> b <em>${span(' c ')}</em>`
      )
    })

    test('should mark context changed when tags swap positions but content remains', () => {
      testDiff(
        '<b>abc</b><i>def</i>',
        '<i>abc</i><b>def</b>',
        [
          { value: '<b>', removed, hasTags, hasUnclosedOpenTags },
          { value: '<i>', added, hasTags, hasUnclosedOpenTags },
          { value: 'abc', contextChanged, hasText },
          { value: '</b><i>', removed, hasTags, hasUnclosedOpenTags, hasUnopenedCloseTags },
          { value: '</i><b>', added, hasTags, hasUnclosedOpenTags, hasUnopenedCloseTags },
          { value: 'def', contextChanged, hasText },
          { value: '</i>', removed, hasTags, hasUnopenedCloseTags },
          { value: '</b>', added, hasTags, hasUnopenedCloseTags },
        ],
        `<i>${span('abc')}</i><b>${span('def')}</b>`
      )
    })
  })
})

function testDiff(oldHtml, newHtml, expectedChanges, expectedHtml) {
  const changes = diffHtml(oldHtml, newHtml)
  arePartsEqual(changes, expectedChanges)
  const html = toHtml(changes)
  assert.strictEqual(html, expectedHtml)
}

/**
 * @param {Array<{
 * value: string;
 * removed?: boolean;
 * added?: boolean;
 * contextChanged?: boolean;
 * hasText?: boolean;
 * hasTags?: boolean;
 * hasUnclosedOpenTags?: boolean;
 * hasUnopenedCloseTags?: boolean;
 * }>} expected
 */
function arePartsEqual(result, expected) {
  assert.deepStrictEqual(
    result,
    expected.map(exp => ({
      removed: false,
      added: false,
      contextChanged: false,
      hasText: false,
      hasTags: false,
      hasUnclosedOpenTags: false,
      hasUnopenedCloseTags: false,
      ...exp
    })),
  )
}

