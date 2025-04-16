// Unicode Private Use Area

export const puaStart = 0xE000
export const puaEnd = 0xF8FF

const pua = /[\uE000-\uF8FF]/g
const puaOrNotPua = /([\uE000-\uF8FF])|([^\uE000-\uF8FF]+)/g

export default {
  get puaRegex() {
    pua.lastIndex = 0
    return pua
  },

  get puaOrNotPuaRegex() {
    puaOrNotPua.lastIndex = 0
    return puaOrNotPua
  }
}
