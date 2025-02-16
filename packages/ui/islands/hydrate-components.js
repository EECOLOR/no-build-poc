import { writeToDom } from '#ui/domInteraction.js'
import { render } from '#ui/render/clientRenderer.js'
import { startStyleHandling } from '#ui/styles/client.js'
import { raw } from '#ui/tags.js'
import { containerMarker } from './containerMarker.js'

// These steps work with the DOM structure created in #islands/index.js/Island
const extractServerRendereredComponentsSteps = [
  [not(isStart), ignore, repeat],
  [isStart, addNode('startNode'), nextStep],
  [isComment, dataAsJson('info'), nextStep],
  [not(isEnd), addNodeToCollection('nodes'), repeat],
  [isEnd, addNode('endNode'), commitAndRestart]
]

startStyleHandling()

await Promise.all(
  findAllComponents().map(async ({ info, nodes }) => {
    const childrenPlaceholder = document.createComment('[childrenPlaceholder]')
    const { [info.name]: Component } = await import(info.path)
    const params = (info.props ? [info.props] : []).concat(raw(childrenPlaceholder))
    const rendered = render(() => Component(...params))

    const nodeReplacements = [].concat(rendered.result)

    if (placeholderWasUsedAtIn(nodeReplacements, childrenPlaceholder))
      replacePlaceholderIn(nodeReplacements, childrenPlaceholder, nodes)
    else if (placeholderWasUsedDeeper(childrenPlaceholder))
      moveNodesToPlaceholderLocation(childrenPlaceholder, nodes)

    if (nodes.length !== nodeReplacements.length)
      throw new Error(
        `Server side rendering did not produce the same amount of nodes as client side rendering\n` +
        `- server: ${nodes.length}\n` +
        `- client: ${nodeReplacements.length}\n`
      )

    writeToDom.outsideAnimationFrame(() => {
      for (const [i, node] of nodes.entries()) {
        const replacement = nodeReplacements[i]
        if (replacement !== node)
          node.replaceWith(replacement)
      }
    })
  })
)

function placeholderWasUsedAtIn(collection, placeholder) {
  return collection.includes(placeholder)
}

function placeholderWasUsedDeeper(placeholder) {
  return Boolean(placeholder.parentNode)
}

function replacePlaceholderIn(collection, placeholder, nodes) {
  const index = collection.indexOf(placeholder)
  const afterPlaceholder = collection.length - (index + 1)
  const replacements = nodes.slice(index, nodes.length - afterPlaceholder)
  collection.splice(index, 1, ...replacements)
}

/**
 * Find all components
 */

function findAllComponents() {
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

/**
 * Move nodes to placeholder location
 */

 function moveNodesToPlaceholderLocation(nodesPlaceholder, originalNodes) {
  const [firstOriginalNode] = originalNodes

  const startNode = determineStartNode(nodesPlaceholder, firstOriginalNode)
  let amountOfNodesToMove = determineNodesToMove(nodesPlaceholder, startNode)

  let current = startNode
  let next = startNode.nextSibling
  nodesPlaceholder.replaceWith(startNode)

  while (amountOfNodesToMove--) {
    const newNext = next.nextSibling
    insertAfter(current, next)

    current = next
    next = newNext
  }
}

function insertAfter(referenceNode, newNode) {
  referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

function determineStartNode(nodesPlaceholder, rootNode) {
  const instructions = getInstructionsFromRootNodeTo(nodesPlaceholder)
  return instructions.reduce((result, f) => f(result), rootNode)
}

function getInstructionsFromRootNodeTo(node) {
  if (node.previousSibling)
    return getInstructionsFromRootNodeTo(node.previousSibling).concat(node => node.nextSibling)

  if (node.parentNode)
    return getInstructionsFromRootNodeTo(node.parentNode).concat(node => node.firstChild)

  return []
}

function countSiblingAfterNode(node) {
  let count = 0
  while (node = node.nextSibling) count++
  return count
}

function determineNodesToMove(nodesPlaceholder, startNode) {
  const nodesToSkip = countSiblingAfterNode(nodesPlaceholder)
  const nodesAfterStart = countSiblingAfterNode(startNode)
  return nodesAfterStart - nodesToSkip
}
