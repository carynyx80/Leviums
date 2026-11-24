import { useState } from 'react'
import { copyText } from '../lib/utils'
import { IconCheck, IconCopy } from './Icons'

export function CopyButton({ value, label, className = '' }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={`copy-btn ${done ? 'done' : ''} ${className}`}
      aria-label={label ? `Copy ${label}` : 'Copy'}
      title="Copy"
      onClick={async () => {
        if (await copyText(value)) {
          setDone(true)
          setTimeout(() => setDone(false), 1400)
        }
      }}
    >
      {done ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
      {label && <span>{done ? 'Copied' : 'Copy'}</span>}
    </button>
  )
}
