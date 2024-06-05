import { tags } from '/machinery/tags.js'
import { createSignal } from '/machinery/signal.js'
import { Runtime } from './Runtime.js'

import styles from './CustomComponent.css' // uiteindelijk misschien met import assertions
import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import * as THREE from 'three'

if (typeof window !== 'undefined') {
  const width = window.innerWidth - 30
  const height = window.innerHeight / 2
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  document.body.appendChild(renderer.domElement)

  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshPhongMaterial({ color: 0x00FF00 })
  const cube = new THREE.Mesh(geometry, material)
  scene.add(cube)

  const light = new THREE.HemisphereLight("#FFFFFF", 1.25 )
  light.position.set(-25, 50, 30);
  scene.add(light)

  camera.position.z = 4

  renderer.setAnimationLoop(animate)

  function animate() {
    cube.rotation.x += 0.01
    cube.rotation.y += 0.01
    renderer.render(scene, camera)
  }
}

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
