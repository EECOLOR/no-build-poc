import { css, tags } from '#ui/tags.js'
import { setContext } from './context.js'
import { Desk } from './desk/Desk.js'
import { createMessageBroker } from './machinery/messageBroker.js'
import { routeMap } from './routeMap.js'

const { div } = tags

const apiVersion = '2024-09-07'

export function Cms({ basePath, deskStructure, documentSchemas, documentView, onError }) {
  return typeof window === 'undefined'
    ? CmsLoader()
    : CmsWithContext({ basePath, deskStructure, documentSchemas, documentView, onError })
}

function CmsLoader() {
  return div('Loading...')
}

CmsWithContext.style = css`& {
  --default-padding: 0.5rem;
  --default-gap: var(--default-padding);

  & > .Desk {
    height: 100%;
  }
}`
function CmsWithContext({ basePath, deskStructure, documentSchemas, documentView, onError }) {
  const versionedRouteMap = withParamsAndPrefix(basePath, routeMap, { version: apiVersion })
  const api = versionedRouteMap.api.versioned

  setContext({
    documentSchemas,
    documentView,
    basePath,
    clientId: window.crypto.randomUUID(),
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
      Desk({ deskStructure }),
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

