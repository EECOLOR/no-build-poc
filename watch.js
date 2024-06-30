import { spawnChildProcess } from './magic/child-process.js'
import { extractAllImports } from './magic/analyser.js'

spawnChildProcess({
  command: 'node',
  parameter: ['--import', './register-hooks.js', '--watch', '--watch-preserve-output', './server/server.js'],
  messageHandlers: {
    'custom-resolve:get-dependencies': async clientFiles => {
      const dependencies = await extractAllImports(clientFiles)
      return dependencies
    }
  }
})
