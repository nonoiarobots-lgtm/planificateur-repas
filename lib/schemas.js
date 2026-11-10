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
          recette_id: { type: 'string', description: 'Slug court et stable du plat, en minuscules avec tirets' },
          emoji_unicode: { type: 'string', description: 'Code hexadécimal OpenMoji, ex: 1F35C' },
          ingredients: {
            type: 'array',
            description: 'Tous les ingrédients du plat principal (pas de l\'entrée ni du dessert), quantités pour toute la famille',
            items: {
              type: 'object',
              properties: {
                nom: { type: 'string' },
                quantite: { type: 'number', description: 'Quantité chiffrée (ex. 400, 0.5)' },
                unite: { type: 'string', description: 'g, kg, ml, cl, l, pièce, c. à soupe…' },
                condiment: { type: 'boolean', description: 'true pour sel, poivre, huile, beurre, vinaigre, moutarde, épices, herbes, ail, oignon, échalote, bouillon' },
              },
              required: ['nom', 'quantite', 'unite', 'condiment'],
              additionalProperties: false,
            },
          },
          temps_preparation: { type: 'integer', description: 'Minutes de préparation active du plat' },
          temps_cuisson: { type: 'integer', description: 'Minutes de cuisson du plat' },
          entree: { type: 'string', description: "Nom de l'entrée ; chaîne vide en plat seul" },
          dessert: { type: 'string', description: 'Nom du dessert (un fruit de saison en plat seul)' },
        },
        required: ['date', 'service', 'plat', 'recette_id', 'emoji_unicode', 'ingredients', 'temps_preparation', 'temps_cuisson', 'entree', 'dessert'],
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

const feu = { type: 'string', enum: ['vert', 'orange', 'rouge'] }

// Avis du Relecteur sur le menu
export const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    feu_semaine: feu,
    synthese: { type: 'string' },
    repas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          service: { type: 'string', enum: ['dejeuner', 'diner'] },
          feu_nutrition: feu,
          feu_faisabilite: feu,
          raison: { type: 'string' },
          suggestion: { type: 'string' },
        },
        required: ['date', 'service', 'feu_nutrition', 'feu_faisabilite', 'raison', 'suggestion'],
        additionalProperties: false,
      },
    },
  },
  required: ['feu_semaine', 'synthese', 'repas'],
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
