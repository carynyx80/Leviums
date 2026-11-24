export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#111114" stroke="rgba(255,255,255,0.08)" />
      <rect x="8.5" y="6.5" width="3.4" height="19" rx="1.4" fill="#C8FF2E" />
      <path d="M14.2 15.4 L21.6 7.6" stroke="#FF2E9A" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <path d="M14.2 16 Q17.6 23.6 24.4 24.2" stroke="#FF2E9A" strokeWidth="3.4" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function Logo() {
  return (
    <a href="#top" className="logo" aria-label="Keelcodes home">
      <LogoMark />
      <span className="logo-word">keelcodes</span>
    </a>
  )
}
