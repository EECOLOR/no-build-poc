import { writeToDom } from './domInteraction.js'
import { render } from './clientRenderer.js'
import { containerMarker } from '/machinery/containerMarker.js'
import { raw } from './tags.js'

await Promise.all(
  findAllComponents().map(async ({ info, nodes }) => {
    const childrenPlaceholder = document.createComment('[childrenPlaceholder]')
    const { default: Component } = await import(info.path)
    const renderResult = render(Component(...(info.props ? [info.props] : []).concat(raw(childrenPlaceholder))))

    if (placeHolderWasUsed(childrenPlaceholder))
      moveChildrenToNewParent(childrenPlaceholder, nodes[0])

    const nodeReplacements = [].concat(renderResult)

    if (nodes.length !== nodeReplacements.length)
      throw new Error(
        `Server side rendering did not produce the same amount of nodes as client side rendering\n` +
        `- server: ${nodes.length}\n` +
        `- client: ${nodeReplacements.length}\n`
      )

    writeToDom.outsideAnimationFrame(() => {
      // listEquality(node, component)
      nodes.forEach((node, i) => {
        const replacement = nodeReplacements[i]
        if (replacement !== node)
          node.replaceWith(replacement)
      })
    })
  })
)

// /**
//  * @param {Node} a
//  * @param {Node} b
//  */
// function listEquality(a, b, path = []) {
//   const equal = a.isEqualNode(b)
//   console.log(path, equal)
//   if (!equal) console.log(a, b)
//   const aChildren = a.childNodes
//   const bChildren = b.childNodes

//   for (let i = 0; i < aChildren.length; i++) {
//     listEquality(aChildren[i], bChildren[i], path.concat(i))
//   }
// }

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
function tryNextStep({ steps, ...state }) {
  return { steps: steps.slice(1), ...state }
}
function commitAndRestart({ node, originalSteps, data, set }) {
  return { node: node.nextSibling, steps: originalSteps, data: {}, set: set.concat(data) }
}

function placeHolderWasUsed(childrenPlaceholder) {
  return Boolean(childrenPlaceholder.parentNode)
}

function moveChildrenToNewParent(childrenPlaceholder, firstOriginalNode) {
  const startNode = determineStartNode(childrenPlaceholder, firstOriginalNode)
  let amountOfNodesToMove = determineNodesToMove(childrenPlaceholder, startNode)

  let current = startNode
  let next = startNode.nextSibling
  childrenPlaceholder.replaceWith(startNode)

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

function determineStartNode(childrenPlaceholder, rootNode) {
  const instructions = getInstructions(childrenPlaceholder)
  return instructions.reduce((result, f) => f(result), rootNode)
}

function getInstructions(node) {
  if (node.previousSibling)
    return getInstructions(node.previousSibling).concat(node => node.nextSibling)

  if (node.parentNode)
    return getInstructions(node.parentNode).concat(node => node.firstChild)

  return []
}

function countSiblingAfterNode(node) {
  let count = 0
  while (node = node.nextSibling) count++
  return count
}

function determineNodesToMove(childrenPlaceholder, startNode) {
  const nodesToSkip = countSiblingAfterNode(childrenPlaceholder)
  const nodesAfterStart = countSiblingAfterNode(startNode)
  return nodesAfterStart - nodesToSkip
}
