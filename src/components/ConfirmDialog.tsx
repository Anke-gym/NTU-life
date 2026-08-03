import type { ReactNode } from 'react'

export function ConfirmDialog({
  open,
  title,
  children,
  destructive,
  cancelLabel = '取消',
  confirmLabel = '确认',
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  children: ReactNode
  destructive?: boolean
  cancelLabel?: string
  confirmLabel?: string
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
          <button type="button" className="button ghost" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={`button ${destructive ? 'danger' : 'primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
