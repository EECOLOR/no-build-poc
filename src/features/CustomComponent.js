import { raw, tags } from '#ui/tags.js'
import { createSignal, derived } from '#ui/signal.js'
import { component, createContext } from '#ui/component.js'
import { clientConfig } from '#ui/ClientConfig.js'
import { css, styled } from '#ui/styled.js'

import { initializeApp } from 'firebase/app'
import { serverTimestamp } from 'firebase/database'
import * as THREE from 'three'

import { Runtime } from './Runtime.js'

import styles from './CustomComponent.css' // uiteindelijk misschien met import assertions

const customContext = createContext()
const CustomProvider = customContext.Provider
const useCustom = customContext.consume

const { div, p, h1, button, strong, span, input, ul, li, template, style } = tags

export function CustomComponent({ title, content }) {
  const runtime = typeof window === 'undefined' ? 'server' : 'client'
  console.log('Rendering custom component on', runtime)

  const [$count, setCount] = createSignal(0)

  if (typeof window !== 'undefined') {
    setInterval(
      () => { setCount(x => x + 1) },
      1000
    )
  }

  const countDownToThree = 3

  return div(
    h1({ className: styles.title },
      title, ' ', $count, ' ', clientConfig.testValue
    ),
    p(content),
    p('> ', FatCount({ $count }), ' <'),
    Runtime({ runtime }),
    StyledComponent1({ $count }),
    StyledComponent2({ $count }),
    ArrayBasedLastFiveCounts({ $count }),
    SlotBasedLastFiveCounts({ $count }),
    button({ type: 'button', onPointerDown: handlePointerDown }, 'Add 10'),
    input({ type: 'text', value: $count }),
    TestRealComponent({ start: 3, title: 'Real component test 1' }),
    TestRealComponent({ start: 6, title: 'Real component test 2' }),
    $count
      .derive(count => count >= countDownToThree)
      .derive(show => show ? ThreeScene() : CountDown({ $count, countDownToThree })),
  )

  function handlePointerDown(e) {
    setCount(x => x + 10)
  }
}

function StyledComponent1({ $count }) {
  return (
    div(
      template({ shadowRootMode: 'open' },
        style(`
          :host {
            display: flex;
            gap: 1rem;

            & > :last-child {
              background-color: lightblue;
              color: unset;
            }
          }

          div {
            background-color: lightgreen;
          }
        `),
        div('Locally styled 1'),
        div('Locally styled ', $count),
      )
    )
  )
}

function StyledComponent2({ $count }) {
  const { div } = styled

  return (
    div(
      css`
        :host {
          display: flex;
          gap: 1rem;

          & > :last-child {
            background-color: lightblue;
            color: unset;
          }
        }

        div {
          background-color: lightgreen;
        }
      `,
      div('Locally styled 1'),
      div('Locally styled ', $count),
    )
  )
}

function TestRealComponent({ start, title }) {
  const [$counter, setCounter] = createSignal(start)

  if (typeof window !== 'undefined')
    setInterval(() => setCounter(x => x + start), 1000)

  return (
    CustomProvider({ value: $counter.derive(counter => `${title} - ${counter}`) },
      div(
        p(title),
        List(),
      )
    )
  )
}

function List() {
  const [$counter, setCounter] = createSignal(1)

  if (typeof window !== 'undefined')
    setInterval(() => setCounter(x => x + 1), 1000)

  return (
    ul(
      li(
        $counter.derive(counter =>
          TestRealChild({ title: `[${counter}] Child of:` })
        )
      )
    )
  )
}

const TestRealChild = component(({ title }) => {
  const $value = useCustom()
  return (
    div(
      p(title),
      $value
    )
  )
})

function ArrayBasedLastFiveCounts({ $count }) {
  const lastFiveCounts = $count.derive(
    (count, oldArray = []) => oldArray.concat(count).slice(-5)
  )

  return (
    p(
      lastFiveCounts.derive(lastFiveCounts =>
        lastFiveCounts
          .map(count => TwoDigitCount({ count }))
          .map((x, i) =>
            [Boolean(i) && ' - ', span(x)]
          )
      ),
      ' - ',
      FatCount({ $count })
    )
  )
}

function SlotBasedLastFiveCounts({ $count }) {
  return (
    p(
      $count
        .derive(count => Math.min(count, 4))
        .derive(length =>
          range(length + 1).map(i => [
            Boolean(i) && ' - ',
            span(
              $count.derive(count => TwoDigitCount({ count: count - (length - i) }))
            )
          ])
        ),
      ' - ',
      FatCount({ $count })
    )
  )
}

function CountDown({ $count, countDownToThree }) {
  return p('Amazing three.js animation in: ', $count.derive(count => countDownToThree - count))
}

function FatCount({ $count }) {
  return strong(derived($count, count => count + count))
}

function TwoDigitCount({ count }) {
  return `${count}`.padStart(2, '0')
}

function ThreeScene() {
  const width = window.innerWidth - 30, height = window.innerHeight / 2

  const cube = Cube()
  const scene = Scene(cube, Light())

  return Renderer({ width, height, scene, animate })

  function animate() {
    cube.rotation.x += 0.01
    cube.rotation.y += 0.01
  }
}

function Scene(...children) {
  const scene = new THREE.Scene()
  children.forEach(child => scene.add(child))
  return scene
}

function Cube() {
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshPhongMaterial({ color: 0x00FF00 })
  const cube = new THREE.Mesh(geometry, material)
  return cube
}

function Light() {
  const light = new THREE.HemisphereLight("#FFFFFF", 1.25 )
  light.position.set(-25, 50, 30);
  return light
}

function Renderer({ width, height, scene, animate }) {
  const camera = Camera({ width, height })

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setAnimationLoop(() => {
    animate()
    renderer.render(scene, camera)
  })

  return raw(renderer.domElement)
}

function Camera({ width, height }) {
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
  camera.position.z = 4
  return camera
}

function range(length) {
  return [...Array(length)].map((_, i) => i)
}
