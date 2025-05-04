// Unicode Private Use Area

export const puaStart = 0xE000
export const puaEnd = 0xF8FF

export default {
  puaRegex: /[\uE000-\uF8FF]/,
  puaOrNotPuaRegex: /([\uE000-\uF8FF])|([^\uE000-\uF8FF]+)/g,
}
