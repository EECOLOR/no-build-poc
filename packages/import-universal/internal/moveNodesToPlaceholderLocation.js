export function moveNodesToPlaceholderLocation(nodesPlaceholder, originalNodes) {
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
