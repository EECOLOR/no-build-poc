import { diff } from './diff.js'
import { mergeChanges } from './merge.js'
import unicode, { puaStart, puaEnd } from './unicode.js'

/** @import { Change, HtmlChange, TagInfo, ValueTag, ValueText } from './types.ts' */

const tagRegex = /<([/]?)([^ />]+)[^/>]*([/]?)>/
const tagsRegex = new RegExp(tagRegex, 'g')
const tagOrNoTagRegex = /(<[^>]+>)|([^<]+)/g

/**
 * @arg {string} oldValue
 * @arg {string} newValue
 */
export function diffHtml(oldValue, newValue) {
  const info = prepareForDiff(oldValue || '', newValue)
  const changes = calculateChanges(info.oldValue, info.newValue, info.placeholderToTag)
  return changes
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
  for (const [tag, rawIsClose, name, rawIsSelfClose] of (oldHtml + newHtml).matchAll(tagsRegex)) {
    if (charCode > puaEnd)
      throw new Error("Placeholder index exceeded Unicode PUA range. Cannot process HTML.")

    if (tagToPlaceholder.has(tag))
      continue

    const isClose = Boolean(rawIsClose)
    const isSelfClose = Boolean(rawIsSelfClose)
    const isOpen = !isClose && !isSelfClose

    const placeholderChar = String.fromCharCode(charCode++)
    tagToPlaceholder.set(tag, placeholderChar)
    placeholderToTag.set(placeholderChar, { value: tag, isOpen, isClose, isSelfClose, name })
  }

  const oldValue = oldHtml.replace(tagsRegex, tagMatch => tagToPlaceholder.get(tagMatch))
  const newValue = newHtml.replace(tagsRegex, tagMatch => tagToPlaceholder.get(tagMatch))

  return { oldValue, newValue, placeholderToTag }
}

/**
 * Runs the actual diff algorithm and then massages the changes so that tag-only changes can be
 * displayed.
 *
 * @arg {string} oldValue
 * @arg {string} newValue
 * @arg {Map<string, TagInfo>} placeholderToTag
 * @returns {Array<HtmlChange>}
 */
function calculateChanges(oldValue, newValue, placeholderToTag) {
  const originalChanges = diff(oldValue, newValue)
  const mergedChanges = mergeChanges(originalChanges)
  const balancedChanges = balanceChanges(mergedChanges, placeholderToTag)
  const changes = []

  let contextChanges = { added: 0, removed: 0 }
  for (const part of balancedChanges) {
    const { added = false, removed = false } = part
    const changed = added || removed

    const openTags = new Set()
    const closeTags = new Set()

    let hasText = false
    let hasTags = false
    let translatedValue = ''
    const contextChanged = (
      !changed &&
      (contextChanges.added > 0 || contextChanges.removed > 0)
    )

    for (const [_, placeholder, text] of part.value.matchAll(unicode.puaOrNotPuaRegex)) {
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

      if (isOpen)
        openTags.add(name)

      if (isClose)
        if (openTags.has(name))
          openTags.delete(name)
        else
          closeTags.add(name)
    }

    const hasUnopenedCloseTags = Boolean(closeTags.size)
    const hasUnclosedOpenTags = Boolean(openTags.size)
    const value = translatedValue

    changes.push({
      value,
      added,
      removed,
      hasText,
      hasTags,
      contextChanged,
      hasUnclosedOpenTags,
      hasUnopenedCloseTags,
    })
  }

  return changes
}

/*
 For direction -1 (backward)

 before:
 [
   { value: "item 1<p>item " },
   { value: "2</p><p>item ", removed: true },
   { value: "3</p>" }
 ]

 after:
 [
   { value: "item 1" },
   { value: "<p>item 2</p>", removed: true },
   { value: "<p>item 3</p>" }
 ]

 For direction 1 (forward)

 before:
 [
   { value: "item 1<p>" },
   { value: "<i>", added: true },
   { value: "item" },
   { value: "</i>", added: true },
   { value: " 2" },
   { value: "</p><p>item 3", added: true },
   { value: "</p>" }
 ]

 after:
 [
   { value: "item 1<p>" },
   { value: "<i>", added: true },
   { value: "item" },
   { value: "</i>", added: true },
   { value: " 2</p>" },
   { value: "<p>item 3</p>", added: true },
   { value: "" }
 ]
*/
/**
 * @arg {Array<Change>} changes
 * @arg {Map<string, TagInfo>} placeholderToTag
 */
function balanceChanges(changes, placeholderToTag) {
  if (changes.length < 2)
    return changes

  for (let i = 1; i < changes.length - 1; i++) {
    const current = changes[i]
    const previous = changes[i - 1]
    const next = changes[i + 1]

    if (!hasChanged(current) || hasChanged(previous) || hasChanged(next))
      continue

    const positionFromEnd = findMovablePosition(current.value, previous.value, placeholderToTag, -1)
    if (positionFromEnd) {
      const segmentToMove = previous.value.slice(positionFromEnd)

      previous.value = previous.value.slice(0, positionFromEnd)
      current.value = segmentToMove + current.value.slice(0, positionFromEnd)
      next.value = segmentToMove + next.value
    }

    const positionFromStart = findMovablePosition(current.value, next.value, placeholderToTag, +1)
    if (positionFromStart) {
      const segmentToMove = current.value.slice(0, positionFromStart)

      previous.value = previous.value + segmentToMove
      current.value = current.value.slice(positionFromStart) + segmentToMove
      next.value = next.value.slice(positionFromStart)
    }
  }

  return changes.filter(change => change.value)
}

/**
 * @param {string} currentValue
 * @param {string} otherValue
 * @param {Map<string, TagInfo} placeholderToTag
 * @param {-1 | 1} direction
 * @returns
 */
function findMovablePosition(currentValue, otherValue, placeholderToTag, direction) {
  const currentLength = currentValue.length
  const otherLength = otherValue.length
  const minLength = Math.min(currentLength, otherLength)

  const isForward = direction > 0
  const stopTagType = isForward ? 'isOpen' : 'isClose'

  let position = 0
  let hasTag = false

  for (let i = 0; i < minLength; i++) {
    const currentPosition = isForward ? i : currentLength - 1 - i
    const otherPosition = isForward ? i : otherLength - 1 - i

    const charFromCurrent = currentValue[currentPosition]
    const charFromOther = otherValue[otherPosition]

    if (charFromCurrent !== charFromOther)
        break

    if (placeholderToTag.has(charFromCurrent)) {
      hasTag = true
      const tag = placeholderToTag.get(charFromCurrent)
      if (tag[stopTagType])
        break
    }

    position += 1
  }

  if (!hasTag)
    return 0

  return direction * position
}

/** @arg {Change} part */
function hasChanged(part) {
  return part.added || part.removed
}

/**
 * Converts changes into renderable html
 *
 * @arg {Array<HtmlChange>} changes
 */
export function toHtml(changes) {
  let result = ''

  for (const part of changes) {
    const { value } = part

    if (part.added && !part.hasText)
      result += value
    else if (part.added && !part.hasTags)
      result += ins(value)
    else if (part.added)
      for (const segment of getValueSegments(value)) {
        if (segment.type === 'text') {
          result += ins(segment.text)
          continue
        }

        result += segment.tag
      }
    else if (part.removed && !part.hasText)
      continue // No need to display removed tags
    else if (part.removed && !part.hasTags)
      result += del(value)
    else if (part.removed) {
      let toDelete = ''
      for (const segment of getValueSegments(value)) {
        if (segment.type === 'text') {
          toDelete += segment.text
          continue
        }

        if (
          (segment.isOpen && segment.isClosed) ||
          (segment.isClose && segment.isClosing)
        ) {
          toDelete += segment.tag
        }
      }
      result += del(toDelete)
    } else if (part.contextChanged && part.hasTags)
      for (const [_, tag, text] of value.matchAll(tagOrNoTagRegex)) {
        if (tag)
          result += tag
        else
          result += contextChange(text)
      }
    else if (part.contextChanged)
      result += contextChange(value)
    else
      result += value
  }

  return result
}

/** @arg {string} value */
function ins(value) {
  return '<ins class="diff-added">' + value + '</ins>'
}
/** @arg {string} value */
function del(value) {
  return '<del class="diff-removed">' + value + '</del>'
}
/** @arg {string} value */
function contextChange(value) {
  return '<span class="diff-context-changed">' + value + '</span>'
}

/** @arg {string} value */
function getValueSegments(value) {
  /** @type {Array<ValueText | ValueTag>} */
  const segments = []

  /** @type {Map<string, ValueTag>} */
  const openTags = new Map()

  for (const [_, rawTag, text] of value.matchAll(tagOrNoTagRegex)) {
    if (text) {
      segments.push({ type: 'text', text })
      continue
    }

    const [tag, rawIsClose, name, rawIsSelfClose] = rawTag.match(tagRegex)
    const isClose = Boolean(rawIsClose)
    const isOpen = !isClose && !rawIsSelfClose

    const segment = /** @type {ValueTag} */ ({ type: 'tag', tag, isClose, isOpen, name })

    if (isOpen)
      openTags.set(name, segment)

    if (isClose && openTags.has(name)) {
      openTags.get(name)['isClosed'] = true
      openTags.delete(name)
      segment['isClosing'] = true
    }

    segments.push(segment)
  }

  return segments
}
