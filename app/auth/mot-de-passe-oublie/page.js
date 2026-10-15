'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const inputStyle = {
  width: '100%', padding: '12px 14px', border: '2px solid var(--cream-dark)',
  borderRadius: 10, fontFamily: "'Nunito', sans-serif", fontSize: 15,
  background: '#fff', color: 'var(--text)', outline: 'none',
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/nouveau-mot-de-passe`,
    })
    setLoading(false)
    if (error) {
      setError(error.status === 429
        ? 'Trop de demandes. Patientez quelques minutes avant de réessayer.'
        : "L'envoi de l'email a échoué. Réessayez.")
      return
    }
    setSent(true)
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', padding: '0 24px' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', border: '2px solid var(--cream-dark)', borderRadius: 14, boxShadow: '0 2px 14px rgba(44,36,22,0.08)', padding: 32 }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/1F511.svg" alt="" style={{ width: 48, height: 48, marginBottom: 8 }} />
          <h1 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 26, fontWeight: 800, color: 'var(--green-dark)', margin: 0 }}>Mot de passe oublié</h1>
          <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, color: 'var(--text-muted)', margin: '4px 0 0' }}>Recevez un lien pour en choisir un nouveau</p>
        </div>

        {sent ? (
          <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, padding: '12px 14px', background: 'var(--cream)', color: 'var(--text)', borderRadius: 10, margin: 0, lineHeight: 1.5 }}>
            Si un compte existe pour <strong>{email}</strong>, un email vient d&apos;être envoyé. Ouvrez le lien qu&apos;il contient <strong>dans ce même navigateur</strong> pour choisir un nouveau mot de passe. Pensez à regarder dans les indésirables.
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Email du compte</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
            </div>

            {error && <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, padding: '10px 14px', background: 'var(--red-light)', color: 'var(--red-dark)', borderRadius: 10, margin: 0 }}>{error}</p>}

            <button type="submit" disabled={loading} style={{
              background: loading ? 'var(--cream-dark)' : 'var(--green)', color: loading ? 'var(--text-muted)' : '#fff',
              border: 'none', borderRadius: 12, padding: '13px 24px',
              fontFamily: "'Nunito', sans-serif", fontSize: 15, fontWeight: 700,
              boxShadow: loading ? 'none' : '0 4px 0 var(--green-dark)',
              cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4,
            }}>
              {loading ? 'Envoi...' : 'Envoyer le lien'}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: 20, fontFamily: "'Nunito', sans-serif", fontSize: 14, color: 'var(--text-muted)' }}>
          <Link href="/auth/login" style={{ color: 'var(--green-dark)', fontWeight: 700, textDecoration: 'none' }}>Retour à la connexion</Link>
        </p>
      </div>
    </main>
  )
}
