import { useEffect, useMemo, useState } from 'react'
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { CalendarDays, Home, ReceiptText, Settings, WalletCards } from 'lucide-react'
import { HomePage } from './pages/HomePage'
import { SchedulePage } from './pages/SchedulePage'
import { MoneyPage } from './pages/MoneyPage'
import { AgendaPage } from './pages/AgendaPage'
import { SettingsPage } from './pages/SettingsPage'
import { useData } from './lib/useData'
import { getCurrentWeek } from './lib/term'
import { getLanguage } from './lib/i18n'
import './styles.css'

const shellCopy = {
  zh: {
    loading: '正在准备本地数据...',
    offline: '离线模式：已缓存的课表、账目和日程仍可使用。',
    update: '新版本可用，保存当前编辑后可立即更新。',
    updateNow: '立即更新',
    nav: '主要导航',
    tabs: ['首页', '课表', '记账', '日程', '设置'],
  },
  en: {
    loading: 'Preparing local data...',
    offline: 'Offline mode: cached schedules, transactions, and agenda remain available.',
    update: 'A new version is available. Save your current edits, then update.',
    updateNow: 'Update now',
    nav: 'Main navigation',
    tabs: ['Home', 'Schedule', 'Money', 'Agenda', 'Settings'],
  },
} as const

const tabDefs = [
  { to: '/', icon: Home },
  { to: '/schedule', icon: CalendarDays },
  { to: '/money', icon: WalletCards },
  { to: '/agenda', icon: ReceiptText },
  { to: '/settings', icon: Settings },
]

function AppShell() {
  const data = useData()
  const term = data.terms[0]
  const [week, setWeek] = useState(1)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [updateReady, setUpdateReady] = useState(false)
  const language = getLanguage(data)
  const t = shellCopy[language]
  const tabs = useMemo(() => tabDefs.map((tab, index) => ({ ...tab, label: t.tabs[index] })), [t])

  useEffect(() => {
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN'
  }, [language])

  useEffect(() => {
    if (term) setWeek(getCurrentWeek(term))
  }, [term])

  useEffect(() => {
    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)
    const onUpdateReady = () => setUpdateReady(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('ntu-life-update-ready', onUpdateReady)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('ntu-life-update-ready', onUpdateReady)
    }
  }, [])

  async function applyUpdate() {
    if (window.__NTU_LIFE_UPDATE_SW__) {
      await window.__NTU_LIFE_UPDATE_SW__(true)
      return
    }
    window.location.reload()
  }

  if (!data.ready || !term) return <main className="loading">{t.loading}</main>

  return (
    <div className="app-shell">
      {(offline || updateReady) && (
        <div className="system-banner" role="status">
          <span>{offline ? t.offline : t.update}</span>
          {updateReady && !offline && <button className="banner-action" type="button" onClick={() => void applyUpdate()}>{t.updateNow}</button>}
        </div>
      )}
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage data={data} term={term} week={week} setWeek={setWeek} />} />
          <Route path="/schedule" element={<SchedulePage data={data} term={term} week={week} setWeek={setWeek} />} />
          <Route path="/money" element={<MoneyPage data={data} />} />
          <Route path="/agenda" element={<AgendaPage data={data} />} />
          <Route path="/settings" element={<SettingsPage data={data} term={term} />} />
        </Routes>
      </main>
      <nav className="tabbar" aria-label={t.nav}>
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <NavLink key={tab.to} to={tab.to} className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
              <Icon size={22} aria-hidden="true" />
              <span>{tab.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  )
}
