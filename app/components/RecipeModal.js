'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const CAT_META = {
  'Marché / Primeur': { color: 'var(--green)',  light: 'var(--green-light)'  },
  'Poissonnerie':     { color: 'var(--blue)',   light: 'var(--blue-light)'   },
  'Boucher':          { color: 'var(--red)',    light: 'var(--red-light)'    },
  'Supermarché':      { color: 'var(--orange)', light: 'var(--orange-light)' },
}

export default function RecipeModal({ recipeId, onClose }) {
  const [recipe, setRecipe] = useState(null)
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!recipeId) return
    setLoading(true)
    setRecipe(null)
    setError(null)

    async function load() {
      try {
        const { data: rec } = await supabase
          .from('recipes')
          .select('*')
          .eq('id', recipeId)
          .single()

        const { data: ings } = await supabase
          .from('recipe_ingredients')
          .select('*')
          .eq('recipe_id', recipeId)

        setIngredients(ings || [])

        if (rec && !rec.steps) {
          const res = await fetch('/api/generate-recipe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipeId })
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Erreur serveur')
          setRecipe({ ...rec, steps: data.steps, search_query: data.search_query || rec.search_query })
        } else {
          setRecipe(rec)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [recipeId])

  // Fermer sur Escape
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  if (!recipeId) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(44,36,22,0.55)',
        zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--cream)', borderRadius: '20px 20px 0 0',
          maxHeight: '88vh', overflowY: 'auto', padding: '0 0 40px',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', position: 'sticky', top: 0, background: 'var(--cream)', zIndex: 1 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--cream-dark)' }} />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--cream-dark)', borderTopColor: 'var(--green)', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite', marginBottom: 16 }} />
            <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
              Génération de la recette en cours… ✨
            </p>
          </div>
        ) : error ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, color: 'var(--red-dark)', background: 'var(--red-light)', borderRadius: 10, padding: '12px 16px' }}>{error}</p>
            <button onClick={onClose} style={{ marginTop: 12, padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--cream-dark)', fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--text-muted)' }}>Fermer</button>
          </div>
        ) : recipe ? (
          <div style={{ padding: '8px 20px 0' }}>
            {/* Header recette */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                {recipe.emoji_unicode && (
                  <img src={`https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/${recipe.emoji_unicode}.svg`} width={36} alt="" style={{ flexShrink: 0 }} />
                )}
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 6px' }}>{recipe.name}</h2>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {recipe.prep_time && <span style={{ background: 'var(--cream-dark)', color: 'var(--text-muted)', borderRadius: 20, padding: '3px 10px', fontFamily: "'Nunito', sans-serif", fontSize: 11, fontWeight: 700 }}>{recipe.prep_time} prép.</span>}
                    {recipe.cook_time && <span style={{ background: 'var(--cream-dark)', color: 'var(--text-muted)', borderRadius: 20, padding: '3px 10px', fontFamily: "'Nunito', sans-serif", fontSize: 11, fontWeight: 700 }}>{recipe.cook_time} cuisson</span>}
                    {recipe.portions && <span style={{ background: 'var(--green-light)', color: 'var(--green-dark)', borderRadius: 20, padding: '3px 10px', fontFamily: "'Nunito', sans-serif", fontSize: 11, fontWeight: 700 }}>{recipe.portions} pers.</span>}
                  </div>
                </div>
              </div>
              <button onClick={onClose} style={{ background: 'var(--cream-dark)', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 8 }}>✕</button>
            </div>

            {/* Ingrédients */}
            {ingredients.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <h3 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Ingrédients</h3>
                <div style={{ background: '#fff', border: '2px solid var(--cream-dark)', borderRadius: 12, overflow: 'hidden' }}>
                  {ingredients.map((ing, i) => {
                    const meta = CAT_META[ing.shop] || {}
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px',
                        borderBottom: i < ingredients.length - 1 ? '1px solid var(--cream-dark)' : 'none' }}>
                        <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{ing.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13, color: 'var(--text-muted)' }}>{ing.quantity} {ing.unit}</span>
                          {ing.shop && (
                            <span style={{
                              background: meta.light || 'var(--cream-dark)', color: meta.color || 'var(--text-muted)',
                              borderRadius: 20, padding: '2px 8px', fontFamily: "'Nunito', sans-serif", fontSize: 11, fontWeight: 700
                            }}>
                              {ing.shop}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Étapes */}
            {recipe.steps && (
              <div style={{ marginBottom: 18 }}>
                <h3 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Préparation</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {recipe.steps.map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%', background: 'var(--green)', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 2px 0 var(--green-dark)',
                      }}>
                        <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 800, color: '#fff' }}>{i + 1}</span>
                      </div>
                      <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 14, color: 'var(--text)', lineHeight: 1.55, paddingTop: 3, margin: 0 }}>
                        {typeof step === 'string' ? step : step.instruction}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tip */}
            {recipe.tip && (
              <div style={{ background: 'var(--orange-light)', borderRadius: 12, borderLeft: '4px solid var(--orange)', padding: '12px 14px', marginBottom: 14 }}>
                <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 800, color: 'var(--orange-dark)', display: 'block', marginBottom: 4 }}>✨ Conseil du chef</span>
                <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 13, margin: 0, color: 'var(--text)', lineHeight: 1.5, fontWeight: 600 }}>{recipe.tip}</p>
              </div>
            )}

            {/* Lien Marmiton */}
            {(recipe.search_query || recipe.name) && (
              <a
                href={`https://www.marmiton.org/recettes/recherche.aspx?aqt=${encodeURIComponent(recipe.search_query || recipe.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px', borderRadius: 12,
                  background: '#fff', border: '2px solid var(--cream-dark)',
                  fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--text-muted)',
                  textDecoration: 'none',
                }}
              >
                <img src="https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg/1F4BB.svg" width={18} alt="" />
                Voir des variantes sur Marmiton
              </a>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', fontFamily: "'Nunito', sans-serif", color: 'var(--text-muted)' }}>
            Recette introuvable
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
