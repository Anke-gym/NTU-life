import { useMemo, useRef, useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { clearAllData, db, exportBackup, restoreBackup } from '../lib/db'
import { downloadText, shareFile } from '../lib/files'
import { agendaToIcs, scheduleToIcs } from '../lib/ics'
import type { AcademicTerm, AppSettings } from '../lib/types'
import type { AppData } from '../lib/useData'

const copy = {
  zh: {
    version: '版本 1.0.0',
    title: '设置',
    subtitle: '所有数据默认仅保存在当前设备浏览器中，不上传服务器。',
    language: '系统语言',
    chinese: '中文',
    english: 'English',
    install: 'PWA 安装',
    installText: '在 iPhone Safari 打开站点，点击“分享”，选择“添加到主屏幕”。若已处于独立窗口，将不会显示浏览器地址栏。',
    capability: '能力检测',
    supported: '支持',
    unsupported: '不可用',
    voiceFallback: '语音 API 不可用时，请点击输入框后使用 iPhone 键盘麦克风听写。',
    dataExport: '数据与导出',
    exportJson: '导出 JSON 备份',
    restoreJson: '从 JSON 恢复',
    exportSchedule: '导出课表 ICS',
    exportAgenda: '导出日程 ICS',
    persist: '请求持久存储',
    clear: '清空全部数据',
    privacy: '隐私说明',
    privacyText: '所有课表、账目和日程默认仅保存在当前设备浏览器中，不上传服务器。清除 Safari 网站数据可能会同时删除本地数据，请定期导出 JSON 备份。',
    clearTitle: '二次确认清空',
    clearBody: '将清空课程、课表规则、账目和日程，并保留默认学期设置。',
    restoreTitle: '恢复 JSON 备份',
    restoreMode: '默认使用合并恢复，不覆盖现有数据。',
    storageGranted: '已请求持久存储',
    storageDenied: '浏览器未授予持久存储',
    counts: (terms: number, courses: number, transactions: number, agenda: number) => `学期 ${terms}，课程 ${courses}，账目 ${transactions}，日程 ${agenda}`,
  },
  en: {
    version: 'Version 1.0.0',
    title: 'Settings',
    subtitle: 'All data is stored locally in this browser by default and is not uploaded to a server.',
    language: 'System Language',
    chinese: '中文',
    english: 'English',
    install: 'PWA Install',
    installText: 'Open this site in iPhone Safari, tap Share, then choose Add to Home Screen. In standalone mode, the browser address bar is hidden.',
    capability: 'Capabilities',
    supported: 'Supported',
    unsupported: 'Unavailable',
    voiceFallback: 'If SpeechRecognition is unavailable, tap an input and use the iPhone keyboard microphone dictation.',
    dataExport: 'Data & Export',
    exportJson: 'Export JSON Backup',
    restoreJson: 'Restore from JSON',
    exportSchedule: 'Export Schedule ICS',
    exportAgenda: 'Export Agenda ICS',
    persist: 'Request Persistent Storage',
    clear: 'Clear All Data',
    privacy: 'Privacy',
    privacyText: 'Schedules, transactions, and agenda items are stored only in this device browser by default. Clearing Safari website data may also delete local data, so export JSON backups regularly.',
    clearTitle: 'Confirm Clear',
    clearBody: 'This clears courses, schedule rules, transactions, and agenda items while keeping the default term settings.',
    restoreTitle: 'Restore JSON Backup',
    restoreMode: 'Merge restore is used by default and will not overwrite existing data.',
    storageGranted: 'Persistent storage requested',
    storageDenied: 'Browser did not grant persistent storage',
    counts: (terms: number, courses: number, transactions: number, agenda: number) => `Terms ${terms}, courses ${courses}, transactions ${transactions}, agenda ${agenda}`,
  },
}

export function SettingsPage({ data, term }: { data: AppData; term: AcademicTerm }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [restoreSummary, setRestoreSummary] = useState<{ payload: unknown; text: string }>()
  const [storage, setStorage] = useState('')
  const language = data.settings?.appLanguage ?? 'zh'
  const t = copy[language]

  const caps = useMemo(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
    return [
      ['Standalone', standalone],
      ['SpeechRecognition', 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window],
      ['IndexedDB', 'indexedDB' in window],
      ['Service Worker', 'serviceWorker' in navigator],
      ['Web Share', 'share' in navigator],
    ]
  }, [])

  async function updateSettings(patch: Partial<AppSettings>) {
    if (!data.settings) return
    await db.settings.put({ ...data.settings, ...patch })
    await data.reload()
  }

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
    setRestoreSummary({ payload, text: t.counts(count.terms, count.courses, count.transactions, count.agenda) })
  }

  return (
    <div className="page">
      <header className="large-title"><span>{t.version}</span><h1>{t.title}</h1><p>{t.subtitle}</p></header>
      <section className="panel">
        <h2>{t.language}</h2>
        <fieldset className="segmented">
          <legend>{t.language}</legend>
          <label className={language === 'zh' ? 'active' : ''}>
            <input type="radio" name="appLanguage" checked={language === 'zh'} onChange={() => void updateSettings({ appLanguage: 'zh' })} />
            {t.chinese}
          </label>
          <label className={language === 'en' ? 'active' : ''}>
            <input type="radio" name="appLanguage" checked={language === 'en'} onChange={() => void updateSettings({ appLanguage: 'en' })} />
            {t.english}
          </label>
        </fieldset>
      </section>
      <section className="panel">
        <h2>{t.install}</h2>
        <p className="muted">{t.installText}</p>
      </section>
      <section className="panel">
        <h2>{t.capability}</h2>
        {caps.map(([label, ok]) => <p className="capability" key={String(label)}><span>{label}</span><b className={ok ? 'ok' : 'no'}>{ok ? t.supported : t.unsupported}</b></p>)}
        <p className="warning">{t.voiceFallback}</p>
      </section>
      <section className="panel">
        <h2>{t.dataExport}</h2>
        <div className="button-column">
          <button className="button primary" type="button" onClick={() => void handleBackup()}>{t.exportJson}</button>
          <button className="button ghost" type="button" onClick={() => fileRef.current?.click()}>{t.restoreJson}</button>
          <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={(event) => void readRestore(event.target.files?.[0])} />
          <button className="button ghost" type="button" onClick={() => void shareFile('ntu-life-schedule-ay26-t1.ics', scheduleToIcs(term, data.courses, data.rules, { includeOnline: false, reminderMinutes: data.settings?.defaultClassReminderMinutes }), 'text/calendar;charset=utf-8')}>{t.exportSchedule}</button>
          <button className="button ghost" type="button" onClick={() => void shareFile('ntu-life-agenda.ics', agendaToIcs(data.agendaItems), 'text/calendar;charset=utf-8')}>{t.exportAgenda}</button>
          <button className="button ghost" type="button" onClick={async () => setStorage(await navigator.storage?.persist?.() ? t.storageGranted : t.storageDenied)}>{t.persist}</button>
          {storage && <p className="muted">{storage}</p>}
          <button className="button danger" type="button" onClick={() => setConfirmClear(true)}>{t.clear}</button>
        </div>
      </section>
      <section className="panel">
        <h2>{t.privacy}</h2>
        <p>{t.privacyText}</p>
      </section>
      <ConfirmDialog open={confirmClear} title={t.clearTitle} destructive onCancel={() => setConfirmClear(false)} onConfirm={() => { void clearAllData().then(data.reload); setConfirmClear(false) }}>{t.clearBody}</ConfirmDialog>
      <ConfirmDialog open={Boolean(restoreSummary)} title={t.restoreTitle} onCancel={() => setRestoreSummary(undefined)} onConfirm={() => { if (restoreSummary) void restoreBackup(restoreSummary.payload, 'merge').then(data.reload); setRestoreSummary(undefined) }}>{restoreSummary?.text}<br />{t.restoreMode}</ConfirmDialog>
    </div>
  )
}
