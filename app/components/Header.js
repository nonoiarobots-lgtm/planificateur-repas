'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const [familyLabel, setFamilyLabel] = useState('')
  const [lastMenuId, setLastMenuId] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: fam }, { data: planning }] = await Promise.all([
        supabase.from('families').select('adults, children, name').eq('user_id', user.id).single(),
        supabase.from('plannings').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])

      if (fam) setFamilyLabel(fam.name || `${fam.adults} adulte${fam.adults > 1 ? 's' : ''} · ${fam.children} enfant${fam.children > 1 ? 's' : ''}`)
      if (planning) setLastMenuId(planning.id)
    }
    load()
  }, [pathname])

  if (pathname.startsWith('/auth')) return null

  // Extrait l'ID depuis /menu/[id] si on y est déjà
  const menuIdFromPath = pathname.startsWith('/menu/') ? pathname.split('/')[2] : null
  const menuHref = menuIdFromPath || lastMenuId ? `/menu/${menuIdFromPath || lastMenuId}` : '/planning'

  const NAV = [
    { label: 'Planning', href: '/planning', icon: '1F4C5', match: (p) => p === '/planning' },
    { label: 'Menu',     href: menuHref,    icon: '1F37D', match: (p) => p.startsWith('/menu') || p.startsWith('/recette') },
    { label: 'Courses',  href: menuHref,    icon: '1F6D2', match: () => false },
    { label: 'Profil',   href: '/profil',   icon: '1F46A', match: (p) => p === '/profil' },
  ]

  return (
    <header>
      <div style={{
        background: '#fff',
        borderBottom: '2px solid var(--cream-dark)',
        padding: '0 20px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div
          className="logo"
          onClick={() => router.push('/planning')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: "'Baloo 2', sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--green-dark)' }}
        >
          <img src="https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/1F957.svg" alt="" style={{ width: 28, height: 28 }} />
          FamiliMeals
        </div>
        {familyLabel && (
          <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
            {familyLabel}
          </span>
        )}
      </div>

      <nav style={{
        background: '#fff',
        borderBottom: '2px solid var(--cream-dark)',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '0 8px',
      }}>
        {NAV.map(({ label, href, icon, match }) => {
          const active = match(pathname)
          return (
            <a
              key={label}
              href={href}
              className="nav-tab"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: '8px 16px',
                fontFamily: "'Nunito', sans-serif",
                fontSize: 11,
                fontWeight: 700,
                color: active ? 'var(--green-dark)' : 'var(--text-muted)',
                textDecoration: 'none',
                borderBottom: active ? '3px solid var(--green)' : '3px solid transparent',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              <img
                src={`https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/${icon}.svg`}
                alt=""
                className="nav-icon"
                style={{ width: 22, height: 22 }}
              />
              <span className="nav-label">{label}</span>
            </a>
          )
        })}
      </nav>
    </header>
  )
}
