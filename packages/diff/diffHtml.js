import { diff } from './diff.js'
import { mergeChanges } from './merge.js'
import { puaStart, puaEnd, puaOnlyRegex, noPuaOrWhitespaceRegex, puaRegex } from './unicode.js'

/** @import { Change } from './diff.js' */

const tagRegex = /<[^>]+>/g

export function diffHtml(oldValue, newValue) {
  const info = prepareForDiff(oldValue || '', newValue)
  const difference = calculateDifference(info.oldValue, info.newValue, info.placeholderToTag)
  const html = prepareForDisplay(difference, info.placeholderToTag)

  return html
}

/**
 * Replaces the tags in the html with unicode symbols and returns the modified html along with a
 * map that allows the html to be converted back
 *
 * @param {string} oldHtml
 * @param {string} newHtml
 */
function prepareForDiff(oldHtml, newHtml) {
  const tagToPlaceholder = new Map()
  const placeholderToTag = new Map()

  let charCode = puaStart
  for (const [tag] of (oldHtml + newHtml).matchAll(tagRegex)) {
    if (charCode > puaEnd)
      throw new Error("Placeholder index exceeded Unicode PUA range. Cannot process HTML.")

    if (tagToPlaceholder.has(tag))
      continue

    const isClose = tag.startsWith('</')
    const isOpen = !isClose && tag.startsWith('<')
    const isSelfClose = isOpen && tag.endsWith('/>')

    const placeholderChar = String.fromCharCode(charCode++)
    tagToPlaceholder.set(tag, placeholderChar)
    placeholderToTag.set(placeholderChar, { value: tag, isOpen, isClose, isSelfClose })
  }

  const oldValue = oldHtml.replace(tagRegex, tagMatch => tagToPlaceholder.get(tagMatch))
  const newValue = newHtml.replace(tagRegex, tagMatch => tagToPlaceholder.get(tagMatch))

  return { oldValue, newValue, placeholderToTag }
}

/**
 * Runs the actual diff algorithm and then massages the changes to that tag-only changes can be
 * displayed. It does this by marking sections with `contextChanged` and `tagsOnly`.
 *
 * @returns {Array<HtmlChange>}
 */
function calculateDifference(oldValue, newValue, placeHolderToTag) {
  const originalDifference = diff(oldValue, newValue)
  const difference = mergeChanges(originalDifference)

  let contextChanges = { added: 0, removed: 0 }
  for (const part of difference) {
    const changed = part.added || part.removed

    // TODO: this could also be when a tag is in the part value
    const isContextChange = changed && puaOnlyRegex.test(part.value)
    const shouldMarkContextChange = (
      !changed &&
      (contextChanges.added > 0 || contextChanges.removed > 0) &&
      noPuaOrWhitespaceRegex.test(part.value)
    )

    if (isContextChange) {
      let isSelfCloseOnly = true // TODO: this probably doesn't cover enough

      for (const [placeholder] of part.value.matchAll(puaRegex)) {
        const tag = placeHolderToTag.get(placeholder)
        isSelfCloseOnly &&= tag.isSelfClose

        contextChanges[part.added ? 'added' : 'removed'] += (
          tag.isSelfClose ? 0 :
          tag.isClose ? -1 :
          tag.isOpen ? 1 :
          0
        )
      }
      part['tagsOnly'] = true
      part['isSelfCloseOnly'] = isSelfCloseOnly
    }

    if (shouldMarkContextChange) {
      part['contextChanged'] = true
    }
  }

  return difference
}

/**
 * Turns the placeholders back into tags and renders the result to a string.
 *
 * @param {Array<HtmlChange>} diffs
 * @param {Map<string, { value: string }>} placeholderToTag
 */
function prepareForDisplay(diffs, placeholderToTag) {
  let result = ''

  for (const part of diffs) {
    const text = part.value.replace(puaRegex, match => placeholderToTag.get(match).value)

    if (part.added && part.tagsOnly && !part.isSelfCloseOnly)
      result += text
    else if (part.added)
      result += '<ins class="diff-added">' + text + '</ins>'
    else if (part.removed && part.tagsOnly && !part.isSelfCloseOnly)
      continue // No need to display removed tags
    else if (part.removed)
      result += '<del class="diff-removed">' + text + '</del>'
    else if (part.contextChanged)
      result += '<span class="diff-context-changed">' + text + '</span>'
    else
      result += text
  }

  return result
}

/** @typedef {Change & { contextChanged?: boolean, tagsOnly?: boolean, isSelfCloseOnly?: boolean }} HtmlChange */
