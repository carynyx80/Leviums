import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

export function Reveal({ children, delay = 0, y = 28, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y, filter: 'blur(6px)' }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function SectionHead({ eyebrow, title, sub, center }: { eyebrow: string; title: ReactNode; sub?: ReactNode; center?: boolean }) {
  return (
    <div className={`section-head ${center ? 'center' : ''}`}>
      <Reveal>
        <span className="eyebrow"><span className="eyebrow-dot" />{eyebrow}</span>
      </Reveal>
      <Reveal delay={0.06}>
        <h2 className="h2">{title}</h2>
      </Reveal>
      {sub && (
        <Reveal delay={0.12}>
          <p className="section-sub">{sub}</p>
        </Reveal>
      )}
    </div>
  )
}
