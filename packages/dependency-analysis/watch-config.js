import { createBrowserAnalyser } from '#browser-code-analyser'

export const config = {
  importHooks: [
    '#import-root-slash/register-hooks.js',
    '#import-universal/register-hooks.js',
    '#import-css/dev/register-hooks.js',
    '#import-client-only/register-hooks.js',
  ],
  messageHandlers: {
    'watch:get-dependencies': async clientFiles => {
      const dependencies = await browserAnalyser.extractAllImports(clientFiles)
      return dependencies
    }
  }
}

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
