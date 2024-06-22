// TODO: This started as an experiment to add context. This however failed as an experiment for that
//       because context needs to be handle differently. It should somehow be passed when tags are
//       constructed. That however might not be enough as context will only be used in custom
//       components. Custom components are rendered in 'wrong' order: child before parent. On top
//       of that, custom components might be rendered as the result of a signal changing.
//       For now we use the concept of 'shallow rendering' here.

// TODO: this should not be `.universal.js` but something like `.context.js`
//       reason for this is that we do not necessarily want all the dependencies of the context
//       children to be included in client side bundle
//
//       we could also choose something more generic than context. The main idea is that we get
//       'shallow' client side scripts that have access to the DOM elements that were created
//       from the server side generated HTML

import { createSignal } from '/machinery/signal.js'

/**
 * @template {import('/machinery/tags.js').Children<any>} T
 * @param {{ color: string }} props
 * @param {T} children
 */
export default function CustomContext({ color }, ...children) {
  const { isClient, domElements } = this

  const [$color, setColor] = createSignal(color)
  $color.subscribe(color => {
    domElements.forEach(domElement => domElement.style['background-color'] = color)
  })
  if (isClient) {
    setInterval(
      () => { setColor(color  => color === 'red' ? 'blue' : 'red') },
      2000
    )
  }
  return isClient ? domElements : children.map(x => {
    x.attributes = { ...x.attributes, style: { ['background-color']: $color.get() } }
    return x
  })
}
