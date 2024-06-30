import { tags } from '#ui/tags.js'

const { div } = tags

export default function UniversalContainer(...children) {
  return (
    div(
      div('Before children'),
      ...children,
      div('After children')
    )
  )
}
