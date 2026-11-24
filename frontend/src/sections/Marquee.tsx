const ITEMS = ['AI Judges', 'Credit scoring', 'Rug detection', 'Trading agents', 'Oracles', 'Wallet risk', 'Airdrop sybil checks', 'DAO proposal review', 'Insurance claims', 'KYC-free reputation', 'Prediction markets', 'Agent-to-agent payments']

export function Marquee() {
  const row = [...ITEMS, ...ITEMS]
  return (
    <section className="marquee-wrap" aria-label="Use cases">
      <div className="marquee">
        <div className="marquee-track">
          {row.map((t, i) => (
            <span className="marquee-item" key={i}>
              {t}
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" fill={i % 2 ? '#FF2E9A' : '#C8FF2E'} /></svg>
            </span>
          ))}
        </div>
      </div>
      <div className="marquee marquee-rev">
        <div className="marquee-track">
          {row.map((t, i) => (
            <span className="marquee-item outline" key={i}>
              Verified {t.toLowerCase()} <span className="sep">/</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
