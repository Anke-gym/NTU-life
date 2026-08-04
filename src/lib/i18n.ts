import type { AppData } from './useData'

export type AppLanguage = 'zh' | 'en'

export function getLanguage(data: Pick<AppData, 'settings'>): AppLanguage {
  return data.settings?.appLanguage ?? 'zh'
}

export const commonCopy = {
  zh: {
    cancel: '取消',
    confirm: '确认',
    save: '保存',
    edit: '编辑',
    delete: '删除',
    close: '关闭',
    add: '添加',
    noData: '暂无数据',
    untitledTeacher: '未填写教师',
    weekdays: [
      { label: '星期一', short: '周一' },
      { label: '星期二', short: '周二' },
      { label: '星期三', short: '周三' },
      { label: '星期四', short: '周四' },
      { label: '星期五', short: '周五' },
      { label: '星期六', short: '周六' },
      { label: '星期日', short: '周日' },
    ],
  },
  en: {
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    edit: 'Edit',
    delete: 'Delete',
    close: 'Close',
    add: 'Add',
    noData: 'No data',
    untitledTeacher: 'No lecturer',
    weekdays: [
      { label: 'Monday', short: 'Mon' },
      { label: 'Tuesday', short: 'Tue' },
      { label: 'Wednesday', short: 'Wed' },
      { label: 'Thursday', short: 'Thu' },
      { label: 'Friday', short: 'Fri' },
      { label: 'Saturday', short: 'Sat' },
      { label: 'Sunday', short: 'Sun' },
    ],
  },
} as const
