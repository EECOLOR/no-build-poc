import { spawnChildProcess } from '#utils/child-process.js'
import { createBrowserAnalyser } from '#browser-code-analyser'

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
  parameter: [
    '--import', '#import-root-slash/register-hooks.js',
    '--import', '#import-universal/register-hooks.js',
    '--import', '#import-css/register-hooks.js',
    '--import', '#import-client-only/register-hooks.js',
    '--watch',
    '--watch-preserve-output',
    './index.js'
  ],
  messageHandlers: {
    'custom-resolve:get-dependencies': async clientFiles => {
      const dependencies = await browserAnalyser.extractAllImports(clientFiles)
      return dependencies
    }
  }
})
