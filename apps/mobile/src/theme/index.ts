/**
 * ASCEND // NOCTURNE
 * v0.11 cinematic system: obsidian depth, celestial gradients, electric
 * cyan for live actions and rare antique-gold reward states.
 */
export const C = {
  bg:'#050912',
  surface:'#0C1529',
  elevated:'#15243D',
  muted:'#253752',
  border:'#283B5C',
  borderActive:'#667CB5',
  ink:'#F4F7FF',
  sub:'#B5C4DE',
  dim:'#8195B8',
  energy:'#83E0FA',
  violet:'#B399FF',
  gold:'#F3C985',
  green:'#75E5D2',
  danger:'#FF869E',
  frost:'#E7F9FF',
  dark:'#07101F',
  glass:'#122742',
  glow:'#235D8B',
  quiet:'#080E1E',
} as const;
export const FX={
  glass:['#182D47','#0A1529'] as const,
  celestial:['#1A3455','#10253F','#0B1230'] as const,
  violet:['#302550','#171C3D','#0B1427'] as const,
  gold:['#55422F','#2A2530','#10182B'] as const,
};
export const LABELS = {
  strength: { label:'Strength', glyph:'STR', tint:'#F9A781' },
  intelligence: { label:'Intellect', glyph:'INT', tint:'#BD9EFF' },
  discipline: { label:'Discipline', glyph:'DIS', tint:'#83E0FA' },
  finance: { label:'Finance', glyph:'FIN', tint:'#F3C985' },
  relationships: { label:'Connections', glyph:'SOC', tint:'#F2A6C0' },
  recovery: { label:'Recovery', glyph:'REC', tint:'#7FE3C7' },
} as const;
