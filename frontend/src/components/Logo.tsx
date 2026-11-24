export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="lv-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF2E9A" />
          <stop offset="1" stopColor="#C8FF2E" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#111114" stroke="rgba(255,255,255,0.08)" />
      <path d="M10 7v14.5a3.5 3.5 0 0 0 3.5 3.5H23" stroke="url(#lv-g)" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <path d="M15.5 13.5l2.6 2.6 5-5.2" stroke="#C8FF2E" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Logo() {
  return (
    <a href="#top" className="logo" aria-label="Levium home">
      <LogoMark />
      <span className="logo-word">levium</span>
    </a>
  )
}
