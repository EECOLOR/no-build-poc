// Unicode Private Use Area

export const puaStart = 0xE000
export const puaEnd = 0xF8FF

export const puaRegex = /[\uE000-\uF8FF]/g
export const puaOnlyRegex = /^(\s*[\uE000-\uF8FF]\s*)+$/
export const noPuaOrWhitespaceRegex = /[^\s\uE000-\uF8FF]/
