import { Show } from 'solid-js'
import { copyText } from '../lib/copy'
import Icon, { type IconName } from './Icon'
import { toast } from './Toast'

export function CopyButton(props: { text: string; label: string; icon?: IconName }) {
  return (
    <button
      type="button"
      class="button small"
      aria-label={props.icon ? `复制 ${props.label}` : props.label}
      onClick={async () => {
        const ok = await copyText(props.text)
        toast(ok ? '已复制到剪贴板' : '复制失败，请重试', ok ? 'success' : 'error')
      }}
    >
      <Show when={props.icon}>{(icon) => <Icon name={icon()} size={15} />}</Show>
      {props.label}
    </button>
  )
}
