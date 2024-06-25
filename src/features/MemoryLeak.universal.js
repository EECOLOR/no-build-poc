import { createSignal } from '/machinery/signal.js';

import { tags } from '/machinery/tags.js'

const { div, h2, p } = tags

export default function MemoryLeak() {
  const [$counter, setCounter] = createSignal(0)
  const [$toggler, setToggler] = createSignal(false)

  if (typeof window !== 'undefined') {
    setInterval(() => setCounter(x => x + 1), 1000)
    setInterval(() => setToggler(x => !x), 2000)
  }

  return (
    div(
      h2('Toggler'),
      $toggler.derive(on => on ? On({ $counter }) : Off({ $counter }))
    )
  )
}

function On({ $counter }) {
  return p('On at ', $counter)
}

function Off({ $counter }) {
  return p('Off at ', $counter)
}
