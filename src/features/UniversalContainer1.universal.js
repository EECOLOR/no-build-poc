import { tags } from '#ui/tags.js'

const { div } = tags

export default function UniversalContainer1(...children) {
  return [
    div('>______________<'),
    ...children,
    div('>¯¯¯¯¯¯¯¯¯¯¯¯¯¯<')
  ]
}
