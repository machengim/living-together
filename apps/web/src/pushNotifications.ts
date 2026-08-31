export const isWebPushEnabled = import.meta.env.VITE_ENABLE_WEB_PUSH === 'true'

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)

  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)))
}

export async function enablePushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Web Push is not supported by this browser')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted')
  }

  const registration = await navigator.serviceWorker.ready
  const publicKeyResponse = await fetch('/push-public-key')
  if (!publicKeyResponse.ok) {
    throw new Error('Web Push is not configured on the server')
  }

  const { publicKey } = await publicKeyResponse.json() as { publicKey: string }
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })

  const subscriptionResponse = await fetch('/push-subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  })

  if (!subscriptionResponse.ok) {
    throw new Error('Could not save the push subscription')
  }
}
