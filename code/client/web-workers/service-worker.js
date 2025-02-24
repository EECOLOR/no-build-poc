/** @type {ServiceWorkerGlobalScope} */
const sw = /** @type {any} */ (self)

sw.addEventListener('install', event => {
  console.log('Service Worker installed')
})

sw.addEventListener('activate', event => {
  console.log('Service worker activated')
  event.waitUntil(sw.clients.claim())
})

sw.addEventListener('push', event => {
  console.log('Push received:', event)
  const data = event.data.json()

  event.waitUntil(
    sw.registration.showNotification(data.title, { body: data.body })
  )
})
