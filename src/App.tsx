import { useEffect, useMemo, useState } from 'react'
import { HashRouter, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { CalendarDays, Home, Mic, ReceiptText, Settings, Upload, WalletCards } from 'lucide-react'
import { HomePage } from './pages/HomePage'
import { SchedulePage } from './pages/SchedulePage'
import { MoneyPage } from './pages/MoneyPage'
import { AgendaPage } from './pages/AgendaPage'
import { SettingsPage } from './pages/SettingsPage'
import { useData } from './lib/useData'
import { getCurrentWeek } from './lib/term'
import './styles.css'

const tabs = [
  { to: '/', label: '首页', icon: Home },
  { to: '/schedule', label: '课表', icon: CalendarDays },
  { to: '/money', label: '记账', icon: WalletCards },
  { to: '/agenda', label: '日程', icon: ReceiptText },
  { to: '/settings', label: '设置', icon: Settings },
]

function AppShell() {
  const data = useData()
  const navigate = useNavigate()
  const term = data.terms[0]
  const [week, setWeek] = useState(1)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    if (term) setWeek(getCurrentWeek(term))
  }, [term])

  useEffect(() => {
    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('ntu-life-update-ready', () => setUpdateReady(true))
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const quickActions = useMemo(() => [
    { label: '导入课表', icon: Upload, action: () => navigate('/schedule?import=1') },
    { label: '记一笔', icon: WalletCards, action: () => navigate('/money?new=1') },
    { label: '语音记录', icon: Mic, action: () => navigate('/agenda?voice=1') },
    { label: '新建日程', icon: ReceiptText, action: () => navigate('/agenda?new=1') },
  ], [navigate])

  if (!data.ready || !term) return <main className="loading">正在准备本地数据...</main>

  return (
    <div className="app-shell">
      {(offline || updateReady) && (
        <div className="system-banner" role="status">
          {offline ? '离线模式：已缓存的课表、账目和日程仍可使用。' : '新版本可用，完成当前编辑后可刷新页面。'}
        </div>
      )}
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage data={data} term={term} week={week} setWeek={setWeek} quickActions={quickActions} />} />
          <Route path="/schedule" element={<SchedulePage data={data} term={term} week={week} setWeek={setWeek} />} />
          <Route path="/money" element={<MoneyPage data={data} />} />
          <Route path="/agenda" element={<AgendaPage data={data} />} />
          <Route path="/settings" element={<SettingsPage data={data} term={term} />} />
        </Routes>
      </main>
      <nav className="tabbar" aria-label="主要导航">
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
