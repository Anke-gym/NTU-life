import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './styles.css'
import { registerSW } from 'virtual:pwa-register'

let currentRegistration: ServiceWorkerRegistration | undefined
let checkingUpdate = false

async function checkForUpdate() {
  if (!currentRegistration || checkingUpdate) return false
  checkingUpdate = true
  try {
    if (currentRegistration.waiting) {
      window.dispatchEvent(new Event('ntu-life-update-ready'))
      return true
    }
    const installingPromise = waitForInstallingWorker(currentRegistration)
    await currentRegistration.update()
    await installingPromise
    const hasWaitingWorker = Boolean(currentRegistration.waiting)
    if (hasWaitingWorker) window.dispatchEvent(new Event('ntu-life-update-ready'))
    return hasWaitingWorker
  } catch {
    return false
  } finally {
    checkingUpdate = false
  }
}

function waitForInstallingWorker(registration: ServiceWorkerRegistration) {
  return new Promise<void>((resolve) => {
    const existing = registration.installing
    if (existing) {
      waitUntilSettled(existing, resolve)
      return
    }
    const timeout = window.setTimeout(resolve, 4000)
    registration.addEventListener('updatefound', () => {
      window.clearTimeout(timeout)
      if (registration.installing) waitUntilSettled(registration.installing, resolve)
      else resolve()
    }, { once: true })
  })
}

function waitUntilSettled(worker: ServiceWorker, resolve: () => void) {
  if (worker.state === 'installed' || worker.state === 'activated' || worker.state === 'redundant') {
    resolve()
    return
  }
  const timeout = window.setTimeout(resolve, 4000)
  const onStateChange = () => {
    if (worker.state === 'installed' || worker.state === 'activated' || worker.state === 'redundant') {
      window.clearTimeout(timeout)
      worker.removeEventListener('statechange', onStateChange)
      resolve()
    }
  }
  worker.addEventListener('statechange', onStateChange)
}

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new Event('ntu-life-update-ready'))
  },
  onOfflineReady() {
    window.dispatchEvent(new Event('ntu-life-offline-ready'))
  },
  onRegisteredSW(_swUrl, registration) {
    currentRegistration = registration
    void checkForUpdate()

    const interval = window.setInterval(() => {
      if (navigator.onLine) void checkForUpdate()
    }, 30 * 60 * 1000)

    window.addEventListener('online', () => void checkForUpdate())
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void checkForUpdate()
    })
    window.addEventListener('pagehide', () => window.clearInterval(interval), { once: true })
  },
})

window.__NTU_LIFE_UPDATE_SW__ = updateSW
window.__NTU_LIFE_CHECK_UPDATE__ = checkForUpdate

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
