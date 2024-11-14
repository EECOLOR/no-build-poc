import { derive, useOnDestroy } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'
import { css, tags } from '#ui/tags.js'
import { setContext } from './context.js'
import { Desk } from './desk/Desk.js'
import { createMessageBroker } from './machinery/messageBroker.js'
import { routeMap } from './routeMap.js'

const { div, a } = tags

const apiVersion = '2024-09-07'

export function Cms({ basePath, deskStructure, documentSchemas, documentView, onError }) {
  return div(
    typeof window === 'undefined'
      ? CmsLoader()
      : CmsOrLogin({ basePath, deskStructure, documentSchemas, documentView, onError })
  )
}

function CmsLoader() {
  return div('Loading...')
}

function CmsOrLogin({ basePath, deskStructure, documentSchemas, documentView, onError }) {
  const $auth = useAuth({ basePath })

  return derive($auth, auth =>
    !auth ? CmsLoader() :
    auth instanceof Error ? div('Error...') :
    auth.authenticated ? CmsWithContext({ basePath, deskStructure, documentSchemas, documentView, onError, auth }) :
    Login({ basePath })
  )
}

function Login({ basePath }) {
  return (
    div(
      div(
        a({ href: basePath + routeMap.api.auth.provider.login({ provider: 'google'}) }, 'Login with Google'),
      ),
      div(
        a({ href: basePath + routeMap.api.auth.provider.login({ provider: 'microsoft' }) }, 'Login with Microsoft'),
      ),
      div(
        a({ href: basePath + routeMap.api.auth.provider.login({ provider: 'noAuth' }) }, 'Fake login'),
      )
    )
  )
}

CmsWithContext.style = css`& {
  --default-padding: 0.5rem;
  --default-gap: var(--default-padding);

  & > .Desk {
    height: 100%;
  }
}`
function CmsWithContext({ basePath, deskStructure, documentSchemas, documentView, onError, auth }) {
  const versionedRouteMap = withParamsAndPrefix(basePath, routeMap, { version: apiVersion })
  const api = versionedRouteMap.api.versioned

  setContext({
    documentSchemas,
    documentView,
    basePath,
    clientId: auth.user.id,
    api,
    events: createMessageBroker({ api, onError }),
    handleError(e) {
      onError(e)
      // TODO: show error toast or something, maybe even full screen
    },
  })

  return (
    div(
      CmsWithContext.style,
      Desk({ deskStructure, auth }),
    )
  )
}

/**
 * @template R
 * @template T
 * @param {R} routeOrRouteMap
 * @param {import('#typescript/utils.ts').Const<T>} params
 * @returns {import('./types.ts').ProvideParamsToRouteMap<R, T>}
 */
function withParamsAndPrefix(basePath, routeOrRouteMap, params) {
  return new Proxy(/** @type {any} */ (routeOrRouteMap), {
    get(target, p) {
      return withParamsAndPrefix(basePath, target[p], params)
    },
    apply(target, _, [providedParams]) {
      return basePath + target({ ...params, ...providedParams })
    },
  })
}

function useAuth({ basePath }) {
  const $auth = useFetch(basePath + routeMap.api.versioned.me({ version: apiVersion }),)
  return $auth.derive(auth =>
    !auth ? null :
    auth instanceof Error ? auth :
    auth.status === 200 ? auth.json :
    auth.status === 401 ? { authenticated: false } :
    null
  )
}

/**
 * @param {Parameters<typeof fetch>[0]} url
 * @param {Parameters<typeof fetch>[1]} options
 */
function useFetch(url, options = undefined) {
  /** @type {{ status: number, body: string, json?: any } | Error} */
  const typedNull = null
  const [$state, setState] = createSignal(typedNull)
  const controller = new AbortController()
  if (options?.signal)
    throw new Error(`No support has been provided to combine abort signals, if you really need this, implement a combineSignals function (listen for the signals and call abort on another controller)`)

  useOnDestroy(() => controller.abort('Component destroyed'))

  fetch(url, { ...options, signal: controller.signal })
    .then(async response => {
      const body = await response.text()
      const result = { status: response.status, body }
      try { result.json = JSON.parse(body) } catch (e) { }
      setState(result)
    })
    .catch(e => {
      console.error(e) // TODO error handling
      setState(e)
    })

  return $state
}
