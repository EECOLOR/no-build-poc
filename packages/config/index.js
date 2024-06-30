import { load } from './load.js'

const configEnv = process.env.CONFIG_ENV

if (!configEnv) exit('No configuration environment was passed in, make sure you supply it. Example `CONFIG_ENV=... npm run ...`')

let config
try { config = await load(configEnv) }
catch (e) { exit(e) }

export default config

function exit(error) {
  console.error(error)
  process.exit(1)
}
