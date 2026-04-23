'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [loggedOut, setLoggedOut] = useState(false)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setChecked(true)
        setLoggedOut(true)
        return
      }
      const { data: family } = await supabase
        .from('families')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
      router.replace(family ? '/planning' : '/profil')
    }
    check()
  }, [])

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--cream)',
      textAlign: 'center',
      gap: 16,
      padding: '0 24px',
    }}>
      <img
        src="https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/1F957.svg"
        alt=""
        style={{
          width: 72,
          height: 72,
          animation: 'pulse 1.8s ease-in-out infinite',
        }}
      />
      <h1 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 32, fontWeight: 800, color: 'var(--green-dark)', margin: 0 }}>
        FamiliMeals
      </h1>
      <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 16, color: 'var(--text-muted)', margin: 0 }}>
        Planifiez vos repas en famille avec l'IA
      </p>

      {!checked && (
        <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
          Chargement...
        </p>
      )}

      {loggedOut && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8, width: '100%', maxWidth: 280 }}>
          <button
            onClick={() => router.push('/auth/login')}
            style={{
              background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 12,
              padding: '12px 24px', fontFamily: "'Nunito', sans-serif", fontSize: 15, fontWeight: 700,
              boxShadow: '0 4px 0 var(--green-dark)', cursor: 'pointer',
            }}
          >
            Se connecter
          </button>
          <button
            onClick={() => router.push('/auth/signup')}
            style={{
              background: 'transparent', color: 'var(--green-dark)',
              border: '2px solid var(--green)', borderRadius: 12,
              padding: '12px 24px', fontFamily: "'Nunito', sans-serif", fontSize: 15, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Créer un compte
          </button>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>
    </main>
  )
}
