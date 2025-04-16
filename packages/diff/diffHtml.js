import { diff } from './diff.js'
import { mergeChanges } from './merge.js'
import unicode, { puaStart, puaEnd } from './unicode.js'

/** @import { Change } from './diff.js' */

const tagRegex = /<([/]?)([^ />]+)[^/>]*([/]?)>/g

export function diffHtml(oldValue, newValue) {
  console.log({ oldValue, newValue })
  const info = prepareForDiff(oldValue || '', newValue)
  const difference = calculateDifference(info.oldValue, info.newValue, info.placeholderToTag)
  const html = prepareForDisplay(difference)

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
  for (const [tag, rawIsClose, name, rawIsSelfClose] of (oldHtml + newHtml).matchAll(tagRegex)) {
    if (charCode > puaEnd)
      throw new Error("Placeholder index exceeded Unicode PUA range. Cannot process HTML.")

    if (tagToPlaceholder.has(tag))
      continue

    const isClose = Boolean(rawIsClose)
    const isOpen = !isClose
    const isSelfClose = Boolean(rawIsSelfClose)

    const placeholderChar = String.fromCharCode(charCode++)
    tagToPlaceholder.set(tag, placeholderChar)
    placeholderToTag.set(placeholderChar, { value: tag, isOpen, isClose, isSelfClose, name })
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
function calculateDifference(oldValue, newValue, placeholderToTag) {
  const originalDifference = diff(oldValue, newValue)
  const difference = mergeChanges(originalDifference)

  const changes = []

  let contextChanges = { added: 0, removed: 0 }
  for (const part of difference) {
    const { value, added, removed } = part
    const changed = added || removed

    const openTags = new Set()
    const closeTags = new Set()

    let hasText = false
    let hasTags = false
    let translatedValue = ''

    for (const [_, placeholder, text] of value.matchAll(unicode.puaOrNotPuaRegex)) {
      if (!placeholder) {
        translatedValue += text
        hasText = true
        continue
      }

      hasTags = true

      const { isSelfClose, isClose, isOpen, name, value } = placeholderToTag.get(placeholder)
      translatedValue += value
      if (changed) {
        contextChanges[added ? 'added' : 'removed'] += (
          isSelfClose ? 0 :
          isClose ? -1 :
          isOpen ? 1 :
          0
        )
      }

      if (isOpen && !isSelfClose)
        openTags.add(name)

      if (isClose && !isSelfClose)
        if (openTags.has(name))
          openTags.delete(name)
        else
          closeTags.add(name)
    }

    if (removed && !hasText)
      continue

    let newValue = ''

    // TODO: adding tags helps when diffing changes that involves markup like <b> and <i>
    //       it however causes problems with adding <li> (additional list items)
    if (changed && hasText)
      for (const name of Array.from(closeTags).reverse())
        newValue += `<${name}>`

    newValue += translatedValue

    if (changed && hasText)
      for (const name of Array.from(openTags).reverse())
        newValue += `</${name}>`

    const contextChanged = (
      !changed &&
      (contextChanges.added > 0 || contextChanges.removed > 0)
    )

    changes.push({ value: newValue, added, removed, contextChanged, hasText })
  }

  console.log('result', changes)

  return changes
}

/**
 * Turns the placeholders back into tags and renders the result to a string.
 *
 * @param {Array<HtmlChange>} diffs
 */
function prepareForDisplay(diffs) {
  let result = ''

  for (const part of diffs) {
    const text = part.value

    if (part.added && !part.hasText)
      result += text
    else if (part.added)
      result += '<ins class="diff-added">' + text + '</ins>'
    else if (part.removed && !part.hasText)
      continue // No need to display removed tags
    else if (part.removed)
      result += '<del class="diff-removed">' + text + '</del>'
    else if (part.contextChanged)
      result += '<span class="diff-context-changed">' + text + '</span>'
    else
      result += text
  }
console.log('result:', result)
  return result
}

/**
 * @typedef {Change & (
 *  { contextChanged: boolean, hasText: boolean }
 * )} HtmlChange
 */
