import { useMemo, useRef, useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { clearAllData, exportBackup, restoreBackup } from '../lib/db'
import { downloadText, shareFile } from '../lib/files'
import { agendaToIcs, scheduleToIcs } from '../lib/ics'
import type { AcademicTerm } from '../lib/types'
import type { AppData } from '../lib/useData'

export function SettingsPage({ data, term }: { data: AppData; term: AcademicTerm }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [restoreSummary, setRestoreSummary] = useState<{ payload: unknown; text: string }>()
  const [storage, setStorage] = useState('')

  const caps = useMemo(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
    return [
      ['Standalone 模式', standalone],
      ['SpeechRecognition', 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window],
      ['IndexedDB', 'indexedDB' in window],
      ['Service Worker', 'serviceWorker' in navigator],
      ['Web Share', 'share' in navigator],
    ]
  }, [])

  async function handleBackup() {
    const payload = JSON.stringify(await exportBackup(), null, 2)
    downloadText('ntu-life-backup.json', payload, 'application/json;charset=utf-8')
  }

  async function readRestore(file?: File) {
    if (!file) return
    const text = await file.text()
    const payload = JSON.parse(text)
    const count = {
      terms: payload.terms?.length ?? 0,
      courses: payload.courses?.length ?? 0,
      transactions: payload.transactions?.length ?? 0,
      agenda: payload.agendaItems?.length ?? 0,
    }
    setRestoreSummary({ payload, text: `学期 ${count.terms}，课程 ${count.courses}，账目 ${count.transactions}，日程 ${count.agenda}` })
  }

  return (
    <div className="page">
      <header className="large-title"><span>版本 1.0.0</span><h1>设置</h1><p>所有数据默认仅保存在当前设备浏览器中，不上传服务器。</p></header>
      <section className="panel">
        <h2>PWA 安装</h2>
        <p className="muted">在 iPhone Safari 打开站点，点击“分享”，选择“添加到主屏幕”。若已处于独立窗口，将不会显示浏览器地址栏。</p>
      </section>
      <section className="panel">
        <h2>能力检测</h2>
        {caps.map(([label, ok]) => <p className="capability" key={String(label)}><span>{label}</span><b className={ok ? 'ok' : 'no'}>{ok ? '支持' : '不可用'}</b></p>)}
        <p className="warning">语音 API 不可用时，请点击输入框后使用 iPhone 键盘麦克风听写。</p>
      </section>
      <section className="panel">
        <h2>数据与导出</h2>
        <div className="button-column">
          <button className="button primary" type="button" onClick={() => void handleBackup()}>导出 JSON 备份</button>
          <button className="button ghost" type="button" onClick={() => fileRef.current?.click()}>从 JSON 恢复</button>
          <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={(event) => void readRestore(event.target.files?.[0])} />
          <button className="button ghost" type="button" onClick={() => void shareFile('ntu-life-schedule-ay26-t1.ics', scheduleToIcs(term, data.courses, data.rules, { includeOnline: false, reminderMinutes: data.settings?.defaultClassReminderMinutes }), 'text/calendar;charset=utf-8')}>导出课表 ICS</button>
          <button className="button ghost" type="button" onClick={() => void shareFile('ntu-life-agenda.ics', agendaToIcs(data.agendaItems), 'text/calendar;charset=utf-8')}>导出日程 ICS</button>
          <button className="button ghost" type="button" onClick={async () => setStorage(await navigator.storage?.persist?.() ? '已请求持久存储' : '浏览器未授予持久存储')}>请求持久存储</button>
          {storage && <p className="muted">{storage}</p>}
          <button className="button danger" type="button" onClick={() => setConfirmClear(true)}>清空全部数据</button>
        </div>
      </section>
      <section className="panel">
        <h2>隐私说明</h2>
        <p>所有课表、账目和日程默认仅保存在当前设备浏览器中，不上传服务器。清除 Safari 网站数据可能会同时删除本地数据，请定期导出 JSON 备份。</p>
      </section>
      <ConfirmDialog open={confirmClear} title="二次确认清空" destructive onCancel={() => setConfirmClear(false)} onConfirm={() => { void clearAllData().then(data.reload); setConfirmClear(false) }}>将清空课程、课表规则、账目和日程，并保留默认学期设置。</ConfirmDialog>
      <ConfirmDialog open={Boolean(restoreSummary)} title="恢复 JSON 备份" onCancel={() => setRestoreSummary(undefined)} onConfirm={() => { if (restoreSummary) void restoreBackup(restoreSummary.payload, 'merge').then(data.reload); setRestoreSummary(undefined) }}>{restoreSummary?.text}<br />默认使用合并恢复，不覆盖现有数据。</ConfirmDialog>
    </div>
  )
}
