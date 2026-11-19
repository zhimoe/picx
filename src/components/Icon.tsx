import type { JSX } from 'solid-js'

const paths = {
  upload: () => <><path d="M12 16V3m-5 5 5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></>,
  images: () => <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 16-5-5a2 2 0 0 0-2.8 0L3 21"/></>,
  settings: () => <><path d="M4 7h5m4 0h7M4 17h9m4 0h3"/><circle cx="11" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></>,
  repo: () => <><path d="M19 3H7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h13V3ZM4 19a2 2 0 0 0 2 2h13M8 7h7"/></>,
  branch: () => <><circle cx="6" cy="5" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10m12-9v1a5 5 0 0 1-5 5H6"/></>,
  folder: () => <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>,
  arrow: () => <path d="M4 12h15m-6-6 6 6-6 6"/>,
  chevron: () => <path d="m6 9 6 6 6-6"/>,
  appearance: () => <><circle cx="12" cy="12" r="8"/><path d="M12 4v16c4.4 0 8-3.6 8-8s-3.6-8-8-8Z" fill="currentColor" stroke="none"/></>,
  external: () => <path d="M13 5h6v6m0-6-9 9m7-1v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5"/>,
  search: () => <><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/></>,
  refresh: () => <><path d="M20 8a8 8 0 0 0-13-2L4 9m0-5v5h5m-5 7a8 8 0 0 0 13 2l3-3m-5 0h5v5"/></>,
  copy: () => <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 4H6a2 2 0 0 0-2 2v10"/></>,
  link: () => <><path d="m10 13 4-4m-5 7-2 2a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0m2-1 2-2a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0" transform="translate(1 0)"/></>,
  check: () => <path d="m5 12 4 4L19 6"/>,
  close: () => <path d="m6 6 12 12M18 6 6 18"/>,
  trash: () => <><path d="M4 6h16m-10 4v7m4-7v7M9 6V4h6v2"/><path d="m6 6 1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></>,
  inbox: () => <path d="M4 4h16l2 11v4H2v-4L4 4ZM2 15h6l2 2h4l2-2h6"/>,
  info: () => <><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></>,
  shield: () => <><path d="M12 22s7-3 7-9V5l-7-3-7 3v8c0 6 7 9 7 9Z"/><path d="m9 12 2 2 4-4"/></>,
} satisfies Record<string, () => JSX.Element>

export type IconName = keyof typeof paths

export default function Icon(props: { name: IconName; size?: number }) {
  return (
    <svg
      width={props.size ?? 18}
      height={props.size ?? 18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.65"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {paths[props.name]()}
    </svg>
  )
}
