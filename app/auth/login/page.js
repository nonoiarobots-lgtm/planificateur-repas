'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const inputStyle = {
  width: '100%', padding: '12px 14px', border: '2px solid var(--cream-dark)',
  borderRadius: 10, fontFamily: "'Nunito', sans-serif", fontSize: 15,
  background: '#fff', color: 'var(--text)', outline: 'none',
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Identifiants incorrects. Vérifiez votre email et mot de passe.')
      setLoading(false)
      return
    }
    router.push('/profil')
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', padding: '0 24px' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', border: '2px solid var(--cream-dark)', borderRadius: 14, boxShadow: '0 2px 14px rgba(44,36,22,0.08)', padding: 32 }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/1F957.svg" alt="" style={{ width: 48, height: 48, marginBottom: 8 }} />
          <h1 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 26, fontWeight: 800, color: 'var(--green-dark)', margin: 0 }}>FamiliMeals</h1>
          <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, color: 'var(--text-muted)', margin: '4px 0 0' }}>Connexion à votre compte</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Mot de passe</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ ...inputStyle, paddingRight: 48 }}
              />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                style={{ position: 'absolute', right: 0, top: 0, height: '100%', padding: '0 12px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <img src={showPassword ? 'https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/1F441.svg' : 'https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/1F648.svg'} alt="" style={{ width: 20, height: 20 }} />
              </button>
            </div>
          </div>

          {error && <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, padding: '10px 14px', background: 'var(--red-light)', color: 'var(--red-dark)', borderRadius: 10, margin: 0 }}>{error}</p>}

          <button type="submit" disabled={loading} style={{
            background: loading ? 'var(--cream-dark)' : 'var(--green)', color: loading ? 'var(--text-muted)' : '#fff',
            border: 'none', borderRadius: 12, padding: '13px 24px',
            fontFamily: "'Nunito', sans-serif", fontSize: 15, fontWeight: 700,
            boxShadow: loading ? 'none' : '0 4px 0 var(--green-dark)',
            cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4,
          }}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontFamily: "'Nunito', sans-serif", fontSize: 14, color: 'var(--text-muted)' }}>
          Pas encore de compte ?{' '}
          <Link href="/auth/signup" style={{ color: 'var(--green-dark)', fontWeight: 700, textDecoration: 'none' }}>S'inscrire</Link>
        </p>
      </div>
    </main>
  )
}
