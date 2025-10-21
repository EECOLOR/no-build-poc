import { asConst } from '#typescript/helpers.js'
import { constant, object, or, string } from '#validation/schema.js'
import { useFetch } from '../machinery/useFetch.js'

const authSchema = or(
  object({
    authenticated: constant(true),
    idProvider: string(),
    user: object({
      email: string(),
      name: string(),
      id: string(),
    })
  }),
  object({
    authenticated: constant(false),
    hint: string()
  }),
)

/** @arg {{ endpoint: string }} props */
export function useAuth({ endpoint }) {
  const $auth = useFetch(endpoint, { schema: authSchema })

  return $auth.derive(auth =>
    !auth ? null :
    auth instanceof Error ? auth :
    auth.status === 200 ? auth.json :
    auth.status === 401 ? asConst({ authenticated: false }) :
    null
  )
}
