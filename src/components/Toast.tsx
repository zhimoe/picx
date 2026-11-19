import { For, createSignal } from 'solid-js'
import Icon from './Icon'

export type ToastKind = 'info' | 'success' | 'error'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

const [toasts, setToasts] = createSignal<ToastItem[]>([])
let nextId = 1

export function toast(message: string, kind: ToastKind = 'info', duration = 4000): void {
  const id = nextId++
  setToasts((items) => [...items, { id, kind, message }])
  window.setTimeout(() => {
    setToasts((items) => items.filter((item) => item.id !== id))
  }, duration)
}

function dismiss(id: number): void {
  setToasts((items) => items.filter((item) => item.id !== id))
}

export function ToastHost() {
  return (
    <div class="toasts" aria-live="polite" aria-atomic="false">
      <For each={toasts()}>
        {(item) => (
          <button
            type="button"
            class={`toast toast-${item.kind}`}
            title="点击关闭"
            onClick={() => dismiss(item.id)}
          >
            <Icon name={item.kind === 'success' ? 'check' : 'info'} size={18} />
            <span>{item.message}</span>
            <Icon name="close" size={15} />
          </button>
        )}
      </For>
    </div>
  )
}
