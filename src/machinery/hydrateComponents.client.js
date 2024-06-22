import { writeToDom } from './domInteraction.js'
import { renderClientTag } from './renderClientTag.js'
import { containerMarker } from '/machinery/containerMarker.js'

await Promise.all(
  findAllComponents().map(async ({ info, nodes }) => {
    if (nodes.length > 1) throw new Error(`Do not support multiple nodes yet`)
    /** @type {Array<HTMLElement>} */
    const [node] = nodes
    const { default: Component } = await import(info.path)
    const component = renderClientTag(Component(info.props))
    writeToDom.outsideAnimationFrame(() => {
      node.replaceWith(component)
    })
  })
)

function findAllComponents() {
  const containers = document.querySelectorAll(`*[${containerMarker}]`)
  return Array.from(containers).flatMap(extractServerRenderedComponents) // this requires flatMap polyfill (es2019)
}

function extractServerRenderedComponents(container) {
  // These steps work with the DOM structure created by the render blocking script
  const steps = [
    [not(isStart), ignore, repeat],
    [isStart, addNode('startNode'), nextStep],
    [isComment, dataAsJson('info'), nextStep],
    [not(isEnd), addNodeToCollection('nodes'), repeat],
    [isEnd, addNode('endNode'), commitAndRestart]
  ]

  return executeSteps({ steps, node: container.firstChild })
}

function executeSteps({ steps, node, data = {}, set = [], originalSteps = steps }) {
  if (!steps.length || !node) return set

  const [[predicate, extractData, determineNext]] = steps

  return executeSteps(
    predicate(node)
      ? determineNext({ node, steps, data: extractData({ data, node }), set, originalSteps })
      : tryNextStep({ node, steps, data, set, originalSteps })
  )
}

// Predicates
function isStart(x) { return isComment(x) && x.data === 'start' }
function isEnd(x) { return isComment(x) && x.data === 'end' }
function isComment(x) { return x.nodeType === 8 }
function not(f) { return x => !f(x) }

// Extraction
function ignore({ data }) { return data }
function dataAsJson(key) { return ({ data, node }) => ({ ...data, [key]: JSON.parse(node.data) }) }
function addNodeToCollection(key) {
  return ({ data, node }) => ({ ...data, [key]: (data[key] ?? []).concat(node) })
}
function addNode(key) { return ({ data, node }) => ({ ...data, [key]: node }) }

// Control
function repeat({ node, ...state }) {
  return { node: node.nextSibling, ...state }
}
function nextStep({ node, steps, ...state }) {
  return { node: node.nextSibling, steps: steps.slice(1), ...state }
}
function tryNextStep({ steps, ...state }) {
  return { steps: steps.slice(1), ...state }
}
function commitAndRestart({ node, originalSteps, data, set }) {
  return { node: node.nextSibling, steps: originalSteps, data: {}, set: set.concat(data) }
}
