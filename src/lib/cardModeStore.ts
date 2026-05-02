type CardMode = 'manual' | 'auto';

const KEY = 'card_modes';

function load(): Record<string, CardMode> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); }
  catch { return {}; }
}

function save(data: Record<string, CardMode>): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getCardMode(cardItemId: string): CardMode {
  return load()[cardItemId] ?? 'manual';
}

export function setCardMode(cardItemId: string, mode: CardMode): void {
  const data = load();
  data[cardItemId] = mode;
  save(data);
}

export function removeCardMode(cardItemId: string): void {
  const data = load();
  delete data[cardItemId];
  save(data);
}
