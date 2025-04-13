/*
  This function uses the concepts from the "An O(ND) Difference Algorithm and Its Variations" paper
  by EUGENE W. MYERS.

  The idea is as follows:

  - Create a grid from the separate characters, oldValue on the horizontal axis, newValue on the
    vertical axis.

        a b c
      ● ● ● ●
    b ● ● ● ●
    c ● ● ● ●
    d ● ● ● ●

  - We are starting at the most top left dot and finding a path to get to the most bottom right dot.

  - We can make 3 kinds of moves:
    1. Horizontal (moving right) indicating a character was removed
    2. Vertial (moving down) indicating a character was added
    3. Diagonal (moving bottom-right) indicating a character was unchanged

  - Diagonal moves get us to the goal the fastest and since they represent unchanged characters this
    will effectively give us the least amount of 'edits' to get from one string to another. And when
    we know all edits to get from one string to the other we effectively have a diff.

  - To find the path we use two loops:
    1. Edits - We explore the grid one 'edit' at a time (horizontal or vertical move, diagonal moves
               are free).
    2. Diagonals - You can draw diagonal lines through the grid, we are using these to effiently
                   explore only the part of the grid that is reachable.


  Please note that the following version was used a basis for implementation:
  https://github.com/kpdecker/jsdiff/blob/2c36f81b41936a9987c4d0d4b3f8625b844fddb3/src/diff/base.js
*/

export function diff(originalOldValue, originalNewValue) {
  if (originalOldValue === originalNewValue)
    return []

  const { oldValue, newValue, unchangedStartLength, unchangedEndLength } = trimUnchangedEnds()

  const [oldLen, newLen] = [oldValue.length, newValue.length]
  const maxEditLength = oldLen + newLen

  const start = { oldPos: -1, newPos: -1, previous: null }
  /** @type {Map<number, Path>} */
  const bestPathsByDiagonal = new Map([[0, start]])

  let minDiagonalToConsider = -Infinity
  let maxDiagonalToConsider = Infinity

  for (let editLength = 1; editLength <= maxEditLength; editLength++) {

    for (
      let diagonal = Math.max(minDiagonalToConsider, -editLength);
      diagonal <= Math.min(maxDiagonalToConsider, editLength);
      diagonal += 2
    ) {
      const bestPathByRemoval = bestPathsByDiagonal.get(diagonal - 1)
      const bestPathByAddition = bestPathsByDiagonal.get(diagonal + 1)

      // We might be able to prune unreachable paths from bestPathsByDiagonal which will improve
      // memory usage.

      /*
        Determine if we can extend the path by adding (moving down from diagonal + 1) or
        removing (moving right from diagonal-1).
      */
      const canAdd = bestPathByAddition && bestPathByAddition.newPos + 1 < newLen
      const canRemove = bestPathByRemoval && bestPathByRemoval.oldPos + 1 < oldLen

      if (!canAdd && !canRemove) {
        bestPathsByDiagonal.delete(diagonal)
        continue
      }

      const shouldAdd = !canRemove ||
        // If we can both add and remove, the 'furthest' path wins
        (canAdd && bestPathByRemoval.oldPos < bestPathByAddition.oldPos)

      /** @type {Path} */
      let nextPath = shouldAdd
        ? {
          oldPos: bestPathByAddition.oldPos,
          newPos: bestPathByAddition.newPos + 1,
          previous: bestPathByAddition,
          added: true,
        }
        : {
          oldPos: bestPathByRemoval.oldPos + 1,
          newPos: bestPathByRemoval.newPos,
          previous: bestPathByRemoval,
          removed: true,
        }

      nextPath = appendUnchangedPath(nextPath)

      if (nextPath.oldPos + 1 >= oldLen && nextPath.newPos + 1 >= newLen)
        return collectChanges(nextPath)

      bestPathsByDiagonal.set(diagonal, nextPath)

      // Make the search space smaller when we reach the end of the grid
      if (nextPath.oldPos + 1 >= oldLen) {
        maxDiagonalToConsider = Math.min(maxDiagonalToConsider, diagonal - 1)
      }
      if (nextPath.newPos + 1 >= newLen) {
        minDiagonalToConsider = Math.max(minDiagonalToConsider, diagonal + 1)
      }
    }
  }

  throw new Error('No path found')

  function appendUnchangedPath(path) {
    const diagonalSteps = followDiagonal(oldValue, newValue, path.oldPos, path.newPos)

    if (!diagonalSteps)
      return path

    return {
      oldPos: path.oldPos + diagonalSteps,
      newPos: path.newPos + diagonalSteps,
      previous: path,
    }
  }

  /** @param {Path} path */
  function collectChanges(path) {
    const changes = []
    let last = {}

    while (path.previous) {

      if (path.added) {
        const value = newValue[path.newPos]

        if (last.added) {
          last.value = value + last.value
        } else {
          last = { added: true, value }
          changes.push(last)
        }

      } else if (path.removed) {
        const value = oldValue[path.oldPos]

        if (last.removed) {
          last.value = value + last.value
        } else {
          last = { removed: true, value }
          changes.push(last)
        }

      } else { // unchanged

        last = { value: oldValue.slice(path.previous.oldPos + 1, path.oldPos + 1) }
        changes.push(last)
      }

      path = path.previous
    }

    if (unchangedStartLength)
      changes.push({ value: originalOldValue.slice(0, unchangedStartLength) })

    changes.reverse()

    if (unchangedEndLength)
      changes.push({ value: originalOldValue.slice(-unchangedEndLength) })

    return changes
  }

  function trimUnchangedEnds() {
    const o = originalOldValue
    const n = originalNewValue

    const unchangedStartLength = followDiagonal(o, n, -1, -1, 1)
    const unchangedEndLength = followDiagonal(o, n, o.length, n.length, -1)

    const oldValue = o.slice(unchangedStartLength, -unchangedEndLength || undefined)
    const newValue = n.slice(unchangedStartLength, -unchangedEndLength || undefined)

    return { oldValue, newValue, unchangedStartLength, unchangedEndLength }
  }
}

function followDiagonal(oldValue, newValue, oldPos, newPos, direction = 1) {
  let steps = 0
  while (true) {
    const nextOldValue = oldValue[oldPos += direction]
    const nextNewValue = newValue[newPos += direction]

    if (!nextOldValue || nextOldValue !== nextNewValue)
      break

    steps++
  }

  return steps
}

/** @typedef {{ oldPos: number, newPos: number, previous: Path | null, added?: boolean, removed?: boolean }} Path */
