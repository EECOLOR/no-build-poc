export type Path = {
  oldPos: number
  newPos: number
  previous: Path | null
  added?: boolean
  removed?: boolean
}

export type Change = {
  value: string
  added?: boolean
  removed?: boolean
}

export type HtmlChange = Change & {
  contextChanged: boolean
  hasText: boolean
  hasTags: boolean
  hasUnclosedOpenTags: boolean
  hasUnopenedCloseTags: boolean
}

export type TagInfo = {
  value: string
  isOpen: boolean
  isClose: boolean
  isSelfClose: boolean
  name: string
}

export type ValueText = {
  type: 'text'
  text: string
}

export type ValueTag = {
  type: 'tag'
  tag: string
  isClose: boolean
  isOpen: boolean
  name: string
  isClosed?: true
  isClosing?: true
}
