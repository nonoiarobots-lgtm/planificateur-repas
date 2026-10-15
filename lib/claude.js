import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const CLAUDE_MODEL = 'claude-sonnet-5-5'

// Erreur dont le message peut être montré tel quel à l'utilisateur
export class GenerationError extends Error {}

/**
 * Appelle Claude en imposant un schéma JSON à la réponse (sorties structurées)
 * et renvoie l'objet déjà parsé. Vérifie stop_reason avant de lire le contenu.
 * - system : consignes stables (rôle, règles)
 * - onText : reçoit le texte au fil de l'eau (progression)
 * - effort : profondeur de réflexion ('low' | 'medium' | 'high')
 */
export async function generateStructured({ system, prompt, schema, maxTokens, effort = 'medium', onText }) {
  const stream = anthropic.beta.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    // Si le modèle décline la demande, l'API la rejoue sur un modèle de repli
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort,
      format: { type: 'json_schema', schema },
    },
    ...(system ? { system } : {}),
    messages: [{ role: 'user', content: prompt }],
  })

  if (onText) stream.on('text', onText)

  const message = await stream.finalMessage()

  if (message.stop_reason === 'max_tokens') {
    throw new GenerationError('La réponse a été coupée car trop longue. Réessayez avec moins de repas.')
  }
  if (message.stop_reason === 'refusal') {
    throw new GenerationError("L'IA a refusé cette demande. Reformulez les contraintes de la semaine.")
  }

  const text = message.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')

  try {
    return JSON.parse(text)
  } catch {
    throw new GenerationError("La réponse de l'IA est illisible. Réessayez.")
  }
}
