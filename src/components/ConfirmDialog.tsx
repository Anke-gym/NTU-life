import type { ReactNode } from 'react'

export function ConfirmDialog({
  open,
  title,
  children,
  destructive,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  children: ReactNode
  destructive?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open) return null
  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title">
        <h2 id="dialog-title">{title}</h2>
        <div className="dialog-body">{children}</div>
        <div className="dialog-actions">
          <button type="button" className="button ghost" onClick={onCancel}>取消</button>
          <button type="button" className={`button ${destructive ? 'danger' : 'primary'}`} onClick={onConfirm}>确认</button>
        </div>
      </div>
    </div>
  )
}
