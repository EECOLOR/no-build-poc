import { tags } from '#ui/tags.js'
import { routeMap } from '../routeMap.js'

const { div, a } = tags

/** @arg {{ basePath: string }} props */
export function Login({ basePath }) {
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
