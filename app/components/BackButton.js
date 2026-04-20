'use client'

import { useRouter } from 'next/navigation'

export default function BackButton({ label = 'Retour', href = null }) {
  const router = useRouter()
  return (
    <button
      onClick={() => href ? router.push(href) : router.back()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'none',
        border: 'none',
        color: 'var(--text-muted)',
        fontFamily: "'Nunito', sans-serif",
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        padding: '8px 0',
        marginBottom: 12,
      }}
    >
      <img src="https://openmoji.org/data/color/svg/2B05.svg" alt="" style={{ width: 18, height: 18 }} />
      {label}
    </button>
  )
}
