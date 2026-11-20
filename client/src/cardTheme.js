// 8 distinct card colors that rotate each round while keeping dark ink readable
export const ROUND_CARD_PALETTE = [
  { round: 1, name: 'Warm Ochre', bg: '#E8AE58' },
  { round: 2, name: 'Sage Olive', bg: '#9BB88F' },
  { round: 3, name: 'Terracotta Coral', bg: '#E38B6F' },
  { round: 4, name: 'Dusty Sky', bg: '#8AB6D6' },
  { round: 5, name: 'Soft Lavender', bg: '#B8A4D6' },
  { round: 6, name: 'Marigold Gold', bg: '#F0C35B' },
  { round: 7, name: 'Mint Seafoam', bg: '#89C7B9' },
  { round: 8, name: 'Warm Rose', bg: '#E49AB0' },
  { round: 9, name: 'Championship Gold', bg: '#E8AE58' },
];

export function getRoundCardColor(roundNum = 1) {
  const index = Math.max(0, (Number(roundNum) || 1) - 1) % ROUND_CARD_PALETTE.length;
  return ROUND_CARD_PALETTE[index].bg;
}

// Generates a topic-matched photo URL for every answer choice with an instant illustrated fallback
export function getAnswerImageUrl(choiceText = '', category = '') {
  const clean = String(choiceText || '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim();
  const keywords = encodeURIComponent(
    [clean, category].filter(Boolean).join(',').slice(0, 60) || 'trivia'
  );
  // Deterministic lock hash so the same answer shows the exact same picture on TV & phones
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  }
  return `https://loremflickr.com/160/160/${keywords}?lock=${hash % 999}`;
}

export function getAnswerFallbackSvg(letter = 'A', choiceText = '') {
  const label = encodeURIComponent(String(choiceText || letter).slice(0, 12));
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="16" fill="%23efe4cf"/><text x="48" y="44" text-anchor="middle" font-family="Georgia,serif" font-size="28" font-weight="bold" fill="%2323170e">${letter}</text><text x="48" y="70" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="%234a3726">${label}</text></svg>`;
}
