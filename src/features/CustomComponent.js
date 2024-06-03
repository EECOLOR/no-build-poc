import { tags } from '/machinery/tags.js'
import { createSignal } from '/machinery/signal.js'
import { Runtime } from './Runtime.js'

import styles from './CustomComponent.css' // uiteindelijk misschien met import assertions

const { div, p, h1, button } = tags

export function CustomComponent({ title, content }) {
  const runtime = typeof window === 'undefined' ? 'server' : 'client'
  console.log('Rendering custom component on', runtime)

  const { signal, setValue } = createSignal(0)

  if (typeof window !== 'undefined')
    setInterval(
      () => {
        setValue(signal.get() + 1)
      },
      1000
    )

  return div(
    h1({ class: styles.title },
      title, ' ', signal
    ),
    p(content),
    Runtime({ runtime }),
    button({ type: 'button', onPointerDown }, 'Add 10')
  )

  function onPointerDown(e) {
    setValue(signal.get() + 10)
  }
}
