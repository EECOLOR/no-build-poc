import { useFetch } from '../machinery/useFetch.js'

export function useAuth({ endpoint }) {
  const $auth = useFetch(endpoint)

  return $auth.derive(auth =>
    !auth ? null :
    auth instanceof Error ? auth :
    auth.status === 200 ? auth.json :
    auth.status === 401 ? { authenticated: false } :
    null
  )
}
