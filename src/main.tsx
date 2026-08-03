import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './styles.css'
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new Event('ntu-life-update-ready'))
  },
  onOfflineReady() {
    window.dispatchEvent(new Event('ntu-life-offline-ready'))
  },
})

window.__NTU_LIFE_UPDATE_SW__ = updateSW

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
