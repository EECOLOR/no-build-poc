import { tags } from '/machinery/tags.js'
import { createSignal, derived } from '/machinery/signal.js'
import { Runtime } from './Runtime.js'

import styles from './CustomComponent.css' // uiteindelijk misschien met import assertions
import { initializeApp } from 'firebase/app'
import { serverTimestamp } from 'firebase/database'
import * as THREE from 'three'
import { component, updateContext, useContext } from '/machinery/component.js'

const { div, p, h1, button, strong, span, input, ul, li } = tags

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
      title, ' ', $count
    ),
    p(content),
    p('> ', FatCount({ $count }), ' <'),
    Runtime({ runtime }),
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

const TestRealComponent = component(({ start, title }) => {
  const [$counter, setCounter] = createSignal(start)
  updateContext({ $value: $counter.derive(counter => `${title} - ${counter}`) })

  if (typeof window !== 'undefined')
    setInterval(() => setCounter(x => x + start), 1000)

  return div(
    p(title),
    ul(
      li(
        TestRealChild({ title: 'Child of:' })
      )
    )
  )
})

const TestRealChild = component(({ title }) => {
  const context = useContext()
  return (
    div(
      p(title),
      context.$value
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

  return renderer.domElement
}

function Camera({ width, height }) {
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
  camera.position.z = 4
  return camera
}

function range(length) {
  return [...Array(length)].map((_, i) => i)
}
