export const C = {
  bg: '#090F1D', surface: '#111C31', elevated: '#182742', muted: '#24344F',
  border: '#2B3C59', ink: '#EEF5FF', sub: '#9BAECA', dim: '#667C9C',
  energy: '#42C6EF', violet: '#9677FF', gold: '#E9BF73', green: '#62D6AB',
  danger: '#FF7E91',
} as const;

export const LABELS = {
  strength: { label: 'Strength', glyph: '💪', tint: '#EF9A76' },
  intelligence: { label: 'Intelligence', glyph: '🧠', tint: '#A58BFF' },
  discipline: { label: 'Discipline', glyph: '🎯', tint: '#75BFFF' },
  finance: { label: 'Finance', glyph: '💰', tint: '#E7BF70' },
  relationships: { label: 'Relationships', glyph: '🤝', tint: '#E48EA8' },
  recovery: { label: 'Recovery', glyph: '🌙', tint: '#7AD8B3' },
} as const;
