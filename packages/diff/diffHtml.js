import { diff } from './diff.js'
import { mergeChanges } from './merge.js'
import unicode, { puaStart, puaEnd } from './unicode.js'

/** @import { Change } from './diff.js' */
const tagRegex = /<([/]?)([^ />]+)[^/>]*([/]?)>/
const tagsRegex = new RegExp(tagRegex, 'g')
const tagOrNoTagRegex = /(<[^>]+>)|([^<]+)/g

const regex = {
  tag: tagRegex,

  get tags() {
    tagsRegex.lastIndex = 0
    return tagsRegex
  },

  get tagOrNoTag() {
    tagOrNoTagRegex.lastIndex = 0
    return tagOrNoTagRegex
  }
}

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
  for (const [tag, rawIsClose, name, rawIsSelfClose] of (oldHtml + newHtml).matchAll(regex.tags)) {
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

  const oldValue = oldHtml.replace(regex.tags, tagMatch => tagToPlaceholder.get(tagMatch))
  const newValue = newHtml.replace(regex.tags, tagMatch => tagToPlaceholder.get(tagMatch))

  return { oldValue, newValue, placeholderToTag }
}

/**
 * Runs the actual diff algorithm and then massages the changes to that tag-only changes can be
 * displayed. It does this by marking sections with `contextChanged` and `tagsOnly`.
 *
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


function balanceChanges(changes, placeholderToTag) {
  if (changes.length < 2)
    return changes

  for (let i = 1; i < changes.length - 1; i++) {
    const current = changes[i]
    if (!hasChanged(current))
      continue

    const previous = changes[i - 1]
    if (hasChanged(previous))
      continue

    const next = changes[i + 1]
    if (hasChanged(next))
      continue

    let previousValue = previous.value
    let currentValue = current.value
    let nextValue = next.value

    const positionFromEnd = balanceFromPrevious(previousValue, currentValue, placeholderToTag)
    if (positionFromEnd) {
      const segmentToMove = previousValue.slice(positionFromEnd)

      previousValue = previousValue.slice(0, positionFromEnd)
      currentValue = segmentToMove + currentValue.slice(0, positionFromEnd)
      nextValue = segmentToMove + nextValue
    }

    const positionFromStart = balanceFromNext(currentValue, nextValue, placeholderToTag)
    if (positionFromStart > -1) {
      const segmentToMove = currentValue.slice(0, positionFromStart)

      previousValue = previousValue + segmentToMove
      currentValue = currentValue.slice(positionFromStart) + segmentToMove
      nextValue = nextValue.slice(positionFromStart)
    }

    previous.value = previousValue
    current.value = currentValue
    next.value = nextValue
  }

  return changes.filter(change => change.value)
}

/*
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
*/
function balanceFromPrevious(previousValue, currentValue, placeholderToTag) {

  const minLength = Math.min(currentValue.length, previousValue.length)

  let positionFromEnd = 0
  let hasTag = false
  while (positionFromEnd > -minLength) {
    positionFromEnd -= 1
    let charFromPrevious = previousValue.slice(positionFromEnd, positionFromEnd + 1 || undefined)
    let charFromCurrent = currentValue.slice(positionFromEnd, positionFromEnd + 1 || undefined)
    if (charFromPrevious !== charFromCurrent) {
      positionFromEnd += 1
      break
    }
    if (placeholderToTag.has(charFromCurrent)) {
      hasTag = true
      const { isClose } = placeholderToTag.get(charFromCurrent)
      if (isClose) {
        positionFromEnd += 1
        break
      }
    }
  }
  if (!hasTag)
    return 0

  return positionFromEnd
}

/*
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
function balanceFromNext(currentValue, nextValue, placeholderToTag) {
  const minLength = Math.min(currentValue.length, nextValue.length)

  let positionFromStart = -1
  let hasTag = false

  while (positionFromStart < minLength) {
    positionFromStart += 1

    let charFromCurrent = currentValue.slice(positionFromStart, positionFromStart + 1)
    let charFromNext = nextValue.slice(positionFromStart, positionFromStart + 1)

    if (charFromCurrent !== charFromNext)
      break

    if (placeholderToTag.has(charFromCurrent)) {
      hasTag = true
      const { isOpen } = placeholderToTag.get(charFromCurrent)
      if (isOpen)
        break
    }
  }

  if (!hasTag)
    return -1

  return positionFromStart
}

function hasChanged(part) {
  return part.added || part.removed
}

/**
 * Turns the placeholders back into tags and renders the result to a string.
 *
 * @param {Array<HtmlChange>} changes
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
      for (const [_, tag, text] of value.matchAll(regex.tagOrNoTag)) {
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

function ins(value) {
  return '<ins class="diff-added">' + value + '</ins>'
}
function del(value) {
  return '<del class="diff-removed">' + value + '</del>'
}
function contextChange(value) {
  return '<span class="diff-context-changed">' + value + '</span>'
}

function getValueSegments(value) {
  /**
   * @type {Array<
   *  { type: 'text', text: string } |
   *  { type: 'tag', tag: string, isClose: boolean, isOpen: boolean, name: string, isClosed?: true, isClosing?: true }
   * >}
   */
  const segments = []

  const openTags = new Map()

  for (const [_, rawTag, text] of value.matchAll(regex.tagOrNoTag)) {
    if (text) {
      segments.push({ type: 'text', text })
      continue
    }

    const [tag, rawIsClose, name, rawIsSelfClose] = rawTag.match(regex.tag)
    const isClose = Boolean(rawIsClose)
    const isOpen = !isClose && !rawIsSelfClose

    const segment = /** @type {const} */ ({ type: 'tag', tag, isClose, isOpen, name })

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

/**
 * @typedef {Change & (
 *  {
 *    contextChanged: boolean
 *    hasText: boolean
 *    hasTags: boolean
 *    hasUnclosedOpenTags: boolean
 *    hasUnopenedCloseTags: boolean
 * })} HtmlChange
 */
