import { containerMarker } from './containerMarker.js'

// These steps work with the DOM structure created in Universal.js
const extractServerRendereredComponentsSteps = [
  [not(isStart), ignore, repeat],
  [isStart, addNode('startNode'), nextStep],
  [isComment, dataAsJson('info'), nextStep],
  [not(isEnd), addNodeToCollection('nodes'), repeat],
  [isEnd, addNode('endNode'), commitAndRestart]
]

export function findAllComponents() {
  const containers = document.querySelectorAll(`*[${containerMarker}]`)
  return Array.from(containers).flatMap(extractServerRenderedComponents)
}

function extractServerRenderedComponents(container) {
  const steps = extractServerRendereredComponentsSteps
  return executeSteps({ steps, node: container.firstChild })
}

function executeSteps({ steps, node, data = {}, set = [], originalSteps = steps }) {
  if (!steps.length || !node) return set

  const [step] = steps
  const [predicate, extractData, determineNext] = step

  return executeSteps(
    predicate(node)
      ? determineNext({ node, steps, data: extractData({ data, node }), set, originalSteps })
      : nextStepWithCurrentNode({ node, steps, data, set, originalSteps })
  )
}

// Predicates
function isStart(x) { return isComment(x) && x.data === 'start' } // We should probably capture an id here in case two universal components are rendered without container
function isEnd(x) { return isComment(x) && x.data === 'end' } // We should probably match a captured id here
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
function commitAndRestart({ node, originalSteps, data, set }) {
  return { node: node.nextSibling, steps: originalSteps, data: {}, set: set.concat(data) }
}
function nextStepWithCurrentNode({ steps, ...state }) {
  return { steps: steps.slice(1), ...state }
}
