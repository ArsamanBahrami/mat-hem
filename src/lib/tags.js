export const TAG_GROUPS = {
  Protein:       ['kyckling', 'nötkött', 'fläsk', 'fisk', 'vegetarisk', 'vegan'],
  Svårighetsgrad:['enkel', 'medel', 'avancerad'],
  Budget:        ['budget'],
  Måltid:        ['frukost', 'lunch', 'middag', 'vardag', 'festlig'],
  Typ:           ['bakning', 'dessert'],
  Tradition:     ['fredagsrätt'],
}

export const ALL_TAGS = Object.values(TAG_GROUPS).flat()

// Tailwind-klasser per grupp (bg + text)
const GROUP_STYLE = {
  Protein:        { base: 'bg-sky-100 text-sky-700 border-sky-200',       active: 'bg-sky-600 text-white border-sky-600' },
  Svårighetsgrad: { base: 'bg-violet-100 text-violet-700 border-violet-200', active: 'bg-violet-600 text-white border-violet-600' },
  Budget:         { base: 'bg-amber-100 text-amber-700 border-amber-200',  active: 'bg-amber-500 text-white border-amber-500' },
  Måltid:         { base: 'bg-forest-100 text-forest-700 border-forest-200', active: 'bg-forest-600 text-white border-forest-600' },
  Typ:            { base: 'bg-pink-100 text-pink-700 border-pink-200',       active: 'bg-pink-500 text-white border-pink-500' },
  Tradition:      { base: 'bg-orange-100 text-orange-700 border-orange-200', active: 'bg-orange-500 text-white border-orange-500' },
}

const TAG_TO_GROUP = {}
for (const [group, tags] of Object.entries(TAG_GROUPS)) {
  for (const tag of tags) TAG_TO_GROUP[tag] = group
}

export function tagStyle(tag, isActive = false) {
  const group  = TAG_TO_GROUP[tag] ?? 'Måltid'
  const styles = GROUP_STYLE[group]
  return isActive ? styles.active : styles.base
}
