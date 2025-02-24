import { clientConfig } from '#ui/islands/clientConfig.js'

if (!navigator.serviceWorker)
  throw new Error('Browser does not support registering service worker')

const serviceWorkerPath = new URL('./web-workers/service-worker.js', import.meta.url).href
const registration = await navigator.serviceWorker.register(serviceWorkerPath, { type: 'module' })
console.log('Service Worker registered')

await registration.update()
console.log('Service Worker updated')

await subscribeToNotifications()

async function subscribeToNotifications() {

  const permission = await Notification.requestPermission()

  if (permission !== 'granted')
    return console.warn('No permission for notifications')

  await refreshSubscription(registration.pushManager)
}

async function refreshSubscription(pushManager) {
  const existingSubscription = await pushManager.getSubscription()
  if (existingSubscription)
    return console.log(existingSubscription)

  console.log("Resubscribing user...")
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: clientConfig.vapid.publicKeyBase64Url,
  })

  console.log(subscription)

  // const response = await fetch("/api/web-push-subscriptions", {
  //   method: "POST",
  //   body: JSON.stringify(subscription),
  //   headers: { "Content-Type": "application/json" },
  // })

  // console.log(response.ok ? 'Subscription created' : `Subscription failed:\nStatus: ${response.status}\nBody: ${await response.text()}`)
}
