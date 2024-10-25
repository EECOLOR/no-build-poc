const unsafeCharsRegexp = /[<>\/\u2028\u2029]/g
const escapedChars = {
  '<': '\\u003C',
  '>': '\\u003E',
  '/': '\\u002F',
  '\u2028': '\\u2028', // line separator
  '\u2029': '\\u2029', // paragraph separator
}

export function safeJsonStringify(data) {
  return JSON.stringify(data).replace(unsafeCharsRegexp, escapeUnsafeChars)
}

function escapeUnsafeChars(unsafeChar) {
  return escapedChars[unsafeChar]
}
