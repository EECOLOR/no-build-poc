import { spawnChildProcess } from './magic/child-process.js'
import { createBrowserAnalyser } from './magic/browser-analyser.js'

const browserAnalyser = createBrowserAnalyser({
  plugins: [
    {
      name: 'no config import in client files',
      setup(build) {
        build.onResolve({ filter: /^#config$/ }, async args => {
          throw `Can not load config in client files`
        })
      }
    }
  ]
})

spawnChildProcess({
  command: 'node',
  parameter: ['--import', './register-hooks.js', '--watch', '--watch-preserve-output', './server/server.js'],
  messageHandlers: {
    'custom-resolve:get-dependencies': async clientFiles => {
      const dependencies = await browserAnalyser.extractAllImports(clientFiles)
      return dependencies
    }
  }
})
