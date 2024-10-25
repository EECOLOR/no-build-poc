import { tags } from '#ui/tags.js'

const { div } = tags

export function UniversalContainer1(...children) {
  return [
    div('<______________>'),
    ...children,
    div('<¯¯¯¯¯¯¯¯¯¯¯¯¯¯>')
  ]
}
