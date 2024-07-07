import { writeToDom } from '#ui/domInteraction.js'
import { render } from '#ui/render/clientRenderer.js'
import { raw } from '#ui/tags.js'
import { findAllComponents } from './internal/findAllComponents.js'
import { moveNodesToPlaceholderLocation } from './internal/moveNodesToPlaceholderLocation.js'

export default 'for typescript'

await Promise.all(
  findAllComponents().map(async ({ info, nodes }) => {
    const childrenPlaceholder = document.createComment('[childrenPlaceholder]')
    const { default: Component } = await import(info.path)
    const params = (info.props ? [info.props] : []).concat(raw(childrenPlaceholder))
    const renderResult = render(Component(...params))

    const nodeReplacements = [].concat(renderResult)

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
        // listEquality(node, replacement)
        if (replacement !== node)
          node.replaceWith(replacement)
      }
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
//   if (!a || !b) return
//   const aChildren = a.childNodes
//   const bChildren = b.childNodes

//   for (let i = 0; i < aChildren.length; i++) {
//     listEquality(aChildren[i], bChildren[i], path.concat(i))
//   }
// }

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
