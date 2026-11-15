/** Original ASCEND visual language: quiet surfaces + rare luminous rewards. */
export const C = {
  bg:'#070D19', surface:'#101B2E', elevated:'#17273E', muted:'#23364D',
  border:'#263852', borderActive:'#41698E', ink:'#F1F6FF', sub:'#A9BDD8',
  dim:'#788EAB', energy:'#51D6FF', violet:'#A28CFF', gold:'#EFC77E',
  green:'#65DCC1', danger:'#FF8796', frost:'#E3F6FF', dark:'#0A1425',
  glass:'#14243D', glow:'#235F89', quiet:'#0B1627',
} as const;

export const LABELS = {
  strength: { label:'Strength', glyph:'STR', tint:'#F7A181' },
  intelligence: { label:'Intellect', glyph:'INT', tint:'#AD96FF' },
  discipline: { label:'Discipline', glyph:'DIS', tint:'#72CEFF' },
  finance: { label:'Finance', glyph:'FIN', tint:'#EFC77E' },
  relationships: { label:'Connections', glyph:'SOC', tint:'#EE9BB4' },
  recovery: { label:'Recovery', glyph:'REC', tint:'#7DDCC5' },
} as const;
