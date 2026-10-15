// Schémas JSON imposés aux réponses de Claude (sorties structurées)

const shoppingItem = {
  type: 'object',
  properties: {
    nom: { type: 'string' },
    quantite: { type: 'string' },
    unite: { type: 'string' },
  },
  required: ['nom', 'quantite', 'unite'],
  additionalProperties: false,
}

export const SHOPPING_CATEGORIES = ['Marché / Primeur', 'Poissonnerie', 'Boucher', 'Supermarché']

export const MENU_SCHEMA = {
  type: 'object',
  properties: {
    repas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date du repas au format AAAA-MM-JJ' },
          service: { type: 'string', enum: ['dejeuner', 'diner'] },
          plat: { type: 'string' },
          recette_id: { type: 'string', description: 'Slug unique du plat, en minuscules avec tirets bas' },
          emoji_unicode: { type: 'string', description: 'Code hexadécimal OpenMoji, ex: 1F35C' },
        },
        required: ['date', 'service', 'plat', 'recette_id', 'emoji_unicode'],
        additionalProperties: false,
      },
    },
    liste_courses: {
      type: 'object',
      properties: Object.fromEntries(
        SHOPPING_CATEGORIES.map(cat => [cat, { type: 'array', items: shoppingItem }])
      ),
      required: SHOPPING_CATEGORIES,
      additionalProperties: false,
    },
  },
  required: ['repas', 'liste_courses'],
  additionalProperties: false,
}

const steps = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      numero: { type: 'integer' },
      instruction: { type: 'string' },
    },
    required: ['numero', 'instruction'],
    additionalProperties: false,
  },
}

// Étapes générées juste après le menu (avec temps et conseil)
export const RECIPE_DETAILS_SCHEMA = {
  type: 'object',
  properties: {
    steps,
    prep_time: { type: 'string' },
    cook_time: { type: 'string' },
    tip: { type: 'string' },
    search_query: { type: 'string' },
  },
  required: ['steps', 'prep_time', 'cook_time', 'tip', 'search_query'],
  additionalProperties: false,
}

// Étapes générées à l'ouverture d'une recette
export const RECIPE_STEPS_SCHEMA = {
  type: 'object',
  properties: {
    steps,
    search_query: { type: 'string' },
  },
  required: ['steps', 'search_query'],
  additionalProperties: false,
}
