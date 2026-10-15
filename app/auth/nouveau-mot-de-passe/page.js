'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const inputStyle = {
  width: '100%', padding: '12px 14px', border: '2px solid var(--cream-dark)',
  borderRadius: 10, fontFamily: "'Nunito', sans-serif", fontSize: 15,
  background: '#fff', color: 'var(--text)', outline: 'none',
}

const MIN_LENGTH = 8

export default function NewPasswordPage() {
  const router = useRouter()
  // 'checking' : lecture du lien ; 'ready' : formulaire ; 'invalid' : lien expiré ou déjà utilisé
  const [status, setStatus] = useState('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function openRecoverySession() {
      // Le client Supabase échange lui-même le ?code= du lien à son initialisation ;
      // getSession() attend la fin de cet échange.
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { setStatus('ready'); return }

      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) { setStatus('ready'); return }
      }
      setStatus('invalid')
    }
    openRecoverySession()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_LENGTH) { setError(`Le mot de passe doit faire au moins ${MIN_LENGTH} caractères.`); return }
    if (password !== confirm) { setError('Les deux mots de passe ne sont pas identiques.'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError(error.code === 'same_password'
        ? "Choisissez un mot de passe différent de l'ancien."
        : 'La modification a échoué. Redemandez un lien et réessayez.')
      return
    }
    router.push('/planning')
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', padding: '0 24px' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', border: '2px solid var(--cream-dark)', borderRadius: 14, boxShadow: '0 2px 14px rgba(44,36,22,0.08)', padding: 32 }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/1F511.svg" alt="" style={{ width: 48, height: 48, marginBottom: 8 }} />
          <h1 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 26, fontWeight: 800, color: 'var(--green-dark)', margin: 0 }}>Nouveau mot de passe</h1>
        </div>

        {status === 'checking' && (
          <p style={{ textAlign: 'center', fontFamily: "'Nunito', sans-serif", fontSize: 14, color: 'var(--text-muted)' }}>Vérification du lien...</p>
        )}

        {status === 'invalid' && (
          <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, padding: '12px 14px', background: 'var(--red-light)', color: 'var(--red-dark)', borderRadius: 10, margin: 0, lineHeight: 1.5 }}>
            Ce lien est expiré, déjà utilisé ou a été ouvert dans un autre navigateur.{' '}
            <Link href="/auth/mot-de-passe-oublie" style={{ color: 'var(--red-dark)', fontWeight: 700 }}>Demander un nouveau lien</Link>
          </p>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Nouveau mot de passe</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  style={{ ...inputStyle, paddingRight: 48 }}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: 0, top: 0, height: '100%', padding: '0 12px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <img src={showPassword ? 'https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/1F441.svg' : 'https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/1F648.svg'} alt="" style={{ width: 20, height: 20 }} />
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Confirmer le mot de passe</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                style={inputStyle}
              />
            </div>

            {error && <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, padding: '10px 14px', background: 'var(--red-light)', color: 'var(--red-dark)', borderRadius: 10, margin: 0 }}>{error}</p>}

            <button type="submit" disabled={loading} style={{
              background: loading ? 'var(--cream-dark)' : 'var(--green)', color: loading ? 'var(--text-muted)' : '#fff',
              border: 'none', borderRadius: 12, padding: '13px 24px',
              fontFamily: "'Nunito', sans-serif", fontSize: 15, fontWeight: 700,
              boxShadow: loading ? 'none' : '0 4px 0 var(--green-dark)',
              cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4,
            }}>
              {loading ? 'Enregistrement...' : 'Enregistrer le mot de passe'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
