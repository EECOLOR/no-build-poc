import { spawnChildProcess } from '#utils/child-process.js'
import { watch } from '#dependency-analysis/watch.js'

spawnChildProcess({
  command: 'node',
  parameter: watch.importHooks
    .flatMap(hook => ['--import', hook])
    .concat('--watch', '--watch-preserve-output', './index.js'),
  messageHandlers: watch.messageHandlers,
})
