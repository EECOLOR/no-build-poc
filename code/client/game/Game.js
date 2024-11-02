import { derive, loop } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'
import { css, tags } from '#ui/tags.js'

const { div, img } = tags

const knokkers = [
  {
    name: 'Edgar',
    img: 'Edgar_Skin-Default.webp',
    levens: 70,
    aanvalsKracht: 35,
  },
  {
    name: 'Frank',
    img: 'Frank_Skin-Default.png',
    levens: 90,
    aanvalsKracht: 20,
  },
  {
    name: 'Leon',
    img: 'Leon_Skin-Default.webp',
    levens: 80,
    aanvalsKracht: 30,
  },
  {
    name: 'Meg',
    img: 'Meg_Skin-Default.png',
    levens: 60,
    aanvalsKracht: 45,
  },
]

const knokkerKiezen = {
  name: 'knokkerKiezen',
  get next() { return strijden }
}
const strijden = {
  name: 'strijden',
  get next() { return null }
}


const firstStap = knokkerKiezen

Game.style = css`& {
}`
export function Game() {
  const [$stap, setStap] = createSignal(firstStap)
  let gekozenKnokker = null
  return (
    div(
      Game.style,
      div('test spel'),
      derive($stap, stap =>
        stap === knokkerKiezen ? KnokkerKiezen({ onKnokkerGekozen: handleKnokkerGekozen }) :
        stap === strijden ? Strijden({ knokker: gekozenKnokker }) :
        null
      )
    )
  )

  function handleKnokkerGekozen(knokker) {
    gekozenKnokker = knokker
    setStap(stap => stap.next)
  }
}

KnokkerKiezen.style = css`& {
  display: flex;
}`
function KnokkerKiezen({ onKnokkerGekozen }) {
  return (
    div(
      KnokkerKiezen.style,
      div('knokker kiezen'),
      knokkers.map(knokker => Knokker({ knokker, onClick: _ => handleClick(knokker) })),
    )
  )

  function handleClick(knokker) {
    console.log('geklikt op knokker', knokker)
    onKnokkerGekozen(knokker)
  }
}

Strijden.style = css`& {
  display: flex;
  justify-content: space-between;
}`
function Strijden({ knokker }) {
  const [$tegenstanders, setTegenstanders] = createSignal(
    knokkers
      .filter(x => x !== knokker)
      .sort(_ => Math.random() > 0.5 ? -1 : 1)
      .map(knokker => createSignal(knokker))
  )
  const $tegenstanderSignal = $tegenstanders.derive(x => x[0])
  const [$knokker, setKnokker] = createSignal(knokker)

  return (
    div(
      Strijden.style,
      div('Strijden met'),
      derive($knokker, knokker => Knokker({ knokker, onClick: handleClick })),
      Tegenstanders({ $knokkers: $tegenstanders })
    )
  )

  function handleClick() {
    const [$tegenstander, setTegenstander] = $tegenstanderSignal.get()
    const tegenstander = $tegenstander.get()
    console.log(knokker.name, 'slaat met', knokker.aanvalsKracht, 'tegen', tegenstander.name)
    setTegenstander(tegenstander => ({
      ...tegenstander,
      levens: tegenstander.levens - knokker.aanvalsKracht
    }))
    if ($tegenstander.get().levens <= 0) {
      setTegenstanders(tegenstanders => tegenstanders.slice(1))
      return
    }
    console.log(tegenstander.name, 'slaat met', tegenstander.aanvalsKracht, 'tegen', knokker.name)
    setKnokker(knokker => ({
      ...knokker,
      levens: knokker.levens - tegenstander.aanvalsKracht
    }))
  }
}

Tegenstanders.style = css`& {

}`
function Tegenstanders({ $knokkers }) {
  return (
    div(
      Tegenstanders.style,
      loop($knokkers, ([x]) => x.get().name, ([$knokker]) =>
        derive($knokker, knokker => Knokker({ knokker }))
      )
    )
  )
}

Knokker.style = css`& {
  &:hover {
    outline: 1px solid black;
  }

  img {
    max-height: 300px;
  }
}`
function Knokker({ knokker, onClick = undefined }) {
  return (
    div({ onClick },
      Knokker.style,
      div(
        div('Naam: ', knokker.name),
        div('Levens: ', knokker.levens),
        div('Aanvalskracht: ', knokker.aanvalsKracht),
      ),
      img({ src: `/static/client/game/images/${knokker.img}` }),
    )
  )
}
