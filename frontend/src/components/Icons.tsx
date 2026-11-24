import type { SVGProps } from 'react'
type P = SVGProps<SVGSVGElement>
const base = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
export const IconCopy = (p: P) => (<svg {...base} {...p}><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>)
export const IconCheck = (p: P) => (<svg {...base} {...p}><path d="M20 6 9 17l-5-5" /></svg>)
export const IconX = (p: P) => (<svg {...base} {...p}><path d="M18 6 6 18M6 6l12 12" /></svg>)
export const IconArrow = (p: P) => (<svg {...base} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>)
export const IconExternal = (p: P) => (<svg {...base} {...p}><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg>)
export const IconChevron = (p: P) => (<svg {...base} {...p}><path d="m6 9 6 6 6-6" /></svg>)
export const IconLogout = (p: P) => (<svg {...base} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>)
export const IconWallet = (p: P) => (<svg {...base} {...p}><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" /><path d="M21 9h-6a3 3 0 0 0 0 6h6z" /></svg>)
export const IconShield = (p: P) => (<svg {...base} {...p}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></svg>)
export const IconCpu = (p: P) => (<svg {...base} {...p}><rect x="5" y="5" width="14" height="14" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /></svg>)
export const IconMsg = (p: P) => (<svg {...base} {...p}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>)
export const IconSign = (p: P) => (<svg {...base} {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>)
export const IconAnchor = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="5" r="2.5" /><path d="M12 7.5V21M5 12H3a9 9 0 0 0 18 0h-2M8 11h8" /></svg>)
export const IconSpark = (p: P) => (<svg {...base} {...p}><path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l3.5 3.5M15.5 15.5 19 19M5 19l3.5-3.5M15.5 8.5 19 5" /></svg>)
