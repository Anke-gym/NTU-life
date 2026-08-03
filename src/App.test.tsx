import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('app shell', () => {
  it('switches bottom tabs and shows voice fallback', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'NTU Life' })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('link', { name: /记账/ }))
    expect(await screen.findByRole('heading', { name: '记账' })).toBeInTheDocument()
    expect(screen.getByText(/键盘麦克风/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: /课表/ }))
    expect(await screen.findByRole('heading', { name: '课表' })).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: '教学周' })).toBeInTheDocument()
  })
})
