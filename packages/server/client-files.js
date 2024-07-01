import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createLookup } from '#utils'

/**
 *
 * @param {{
 *   clientFiles: Array<{ url: string, specifier: string }>
 *   cssFiles: Array<{ url: string, modifiedSourcePath: string, classMapAsJsPath: string }>
 * }} props
 * @returns
 */
export async function convertClientFiles({ clientFiles, cssFiles }) {
  const cssLookup = createLookup(cssFiles, { key: x => x.url })

  const parsedClientFiles = clientFiles.map(({ url, specifier }) =>
    ({ specifier, parsed: getPathInformation(url), cssInfo: cssLookup[url] })
  )

  // add /static or to support relative imports
  const { css, imports, staticFileMapping } = parsedClientFiles.reduce(
    ({ css, imports, staticFileMapping }, { specifier, parsed, cssInfo }) => {
      const { relativePath, publicPath, type, relativeToRootPath } = parsed

      if (relativePath.endsWith('.css')) {
        css.push(publicPath)

        const publicClassMapPath = `${publicPath}.js`

        staticFileMapping[publicPath] = cssInfo.modifiedSourcePath
        staticFileMapping[publicClassMapPath] = cssInfo.classMapAsJsPath

        imports[publicPath] = publicClassMapPath
      }

      if (relativePath.endsWith('.js') || type === 'lib') {
        staticFileMapping[publicPath] = relativeToRootPath

        if (['package', 'lib'].includes(type) && !specifier.startsWith('.'))
          imports[specifier] = publicPath
      }

      return { css, imports, staticFileMapping }
    },
    {
      css: [],
      imports: {
        '/': '/static/',
        '/static/': '/static/',
        '/static_library/': '/static_library/',
        '/static_package/': '/static_package/',
      },
      staticFileMapping: {},
    }
  )

  return { css, importMap: { imports }, staticFileMapping }
}

const info = /** @type {const} */({
  'src': {
    type: 'src',
    basePath: './src',
    publicPath: '/static/',
  },
  'node_modules': {
    type: 'lib',
    basePath: './node_modules',
    publicPath: '/static_library/',
  },
  'packages': {
    type: 'package',
    basePath: './packages',
    publicPath: '/static_package/',
  },
})

export function getPathInformation(url) {
  const [bareUrl] = url.split(/[?#]/)
  const relativeToRootPath = path.relative('./', fileURLToPath(bareUrl))


  const [dirInRoot] = /** @type {[keyof info, ...any]} */ (relativeToRootPath.split('/'))
  const { type, basePath, publicPath } = info[dirInRoot]

  const relativePath = path.relative(basePath, relativeToRootPath)

  return /** @type {const} */ ({
    type,
    relativePath,
    relativeToRootPath,
    publicPath: `${publicPath}${relativePath}`,
  })
}
