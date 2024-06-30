import { tags } from '#ui/tags.js'

export default 'for typescript'

console.log('import.client.js:', import.meta)
console.log('import.client.js:', 'create tag', tags.div({ 'data-banana': 'attribute' }, tags.p('Test content')))
