import { spawnChildProcess } from '#utils/child-process.js'
import { config } from '#dependency-analysis/watch-config.js'

spawnChildProcess({
  command: 'node',
  parameter: config.importHooks
    .flatMap(hook => ['--import', hook])
    .concat('--watch', '--watch-preserve-output', '--experimental-sqlite', './index.js'),
  messageHandlers: config.messageHandlers,
})
