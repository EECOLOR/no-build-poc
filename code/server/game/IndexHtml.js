import { tags } from '#ui/tags.js'

import { Island, ImportMap, HydrateComponents } from '#islands'
import { Game } from '/client/game/Game.js'

const { html, head, body, script, b, p, i, br } = tags

export function IndexHtml({ importMap }) {
  return (
    html({ lang: 'en_US' },
      head(
        ImportMap({ importMap }),
        HydrateComponents(),
      ),
      body(
        Island('/client/game/Game.js', Game),
      )
    )
  )
}
