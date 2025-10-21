import { derive } from '#ui/dynamic.js'
import { css, tags } from '#ui/tags.js'
import { Login } from './auth/Login.js'
import { useAuth } from './auth/useAuth.js'
import { setContext } from './context.js'
import { Desk } from './desk/Desk.js'
import { createMessageBroker } from './machinery/messageBroker.js'
import { withParamsAndPrefix } from './machinery/routeMap.js'
import { routeMap } from './routeMap.js'
/** @import { DeskStructure, DocumentSchemas, DocumentView, FieldTypes, PaneTypes } from './cmsConfigTypes.ts' */
/** @import { AuthenticatedInfo } from '../types.ts' */

const { div } = tags

const apiVersion = '2024-09-07'

/**
 * @typedef {{
 *   basePath: string,
 *   deskStructure: DeskStructure,
 *   paneTypes: PaneTypes,
 *   documentSchemas: DocumentSchemas,
 *   fieldTypes: FieldTypes,
 *   documentView: DocumentView,
 *   onError: (e: Error) => void,
 * }} CmsProps
 */

/** @arg {CmsProps} props */
export function Cms({ basePath, deskStructure, paneTypes, documentSchemas, fieldTypes, documentView, onError }) {
  return div(
    typeof window === 'undefined'
      ? CmsLoader()
      : CmsOrLogin({ basePath, deskStructure, paneTypes, documentSchemas, fieldTypes, documentView, onError })
  )
}

function CmsLoader() {
  return div('Loading...')
}

/** @arg {CmsProps} props */
function CmsOrLogin({ basePath, deskStructure, paneTypes, documentSchemas, fieldTypes, documentView, onError }) {
  const $auth = useAuth({ endpoint: basePath + routeMap.api.versioned.me({ version: apiVersion }) })

  return derive($auth, auth => {
    if (!auth)
      return CmsLoader()

    if (auth instanceof Error)
      return AuthError({ error: auth })

    if (!auth.authenticated)
      return Login({ basePath })

    return CmsWithContext({
      basePath,
      deskStructure,
      paneTypes,
      documentSchemas,
      fieldTypes,
      documentView,
      onError,
      auth,
    })
  })
}

/** @arg {{ error: Error }} props */
function AuthError({ error }) {
  return div('Error...')
}

CmsWithContext.style = css`
  --default-spacing: 0.75rem;
  --default-padding: var(--default-spacing);
  --default-gap: var(--default-spacing);
  --default-border: 1px solid lightgray;

  & > .Desk {
    height: 100%;
  }
`
/** @arg {CmsProps & { auth: AuthenticatedInfo }} props */
function CmsWithContext({ basePath, deskStructure, paneTypes, documentSchemas, fieldTypes, documentView, onError, auth }) {
  const versionedRouteMap = withParamsAndPrefix(basePath, routeMap, { version: apiVersion })
  const api = versionedRouteMap.api.versioned

  setContext({
    documentSchemas,
    fieldTypes,
    documentView,
    basePath,
    userId: auth.user.id,
    clientId: crypto.randomUUID(),
    api,
    events: createMessageBroker({ api, onError }),
    handleError(e) {
      onError(e)
      // TODO: show error toast or something, maybe even full screen
    },
  })

  return (
    div({ className: 'CmsWithContext', css: CmsWithContext.style },
      Desk({ deskStructure, paneTypes, auth }),
    )
  )
}
