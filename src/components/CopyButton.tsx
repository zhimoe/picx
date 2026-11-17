import { copyText } from '../lib/copy'
import { toast } from './Toast'

export function CopyButton(props: { text: string; label: string }) {
  return (
    <button
      type="button"
      class="button small"
      onClick={async () => {
        const ok = await copyText(props.text)
        toast(ok ? '已复制到剪贴板' : '复制失败，请手动选择', ok ? 'success' : 'error')
      }}
    >
      {props.label}
    </button>
  )
}
