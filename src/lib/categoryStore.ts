type Category = 'salary' | 'card' | 'regular';

const KEY = 'fxitem_categories';

function load(): Record<string, Category> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); }
  catch { return {}; }
}

function save(data: Record<string, Category>): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getCategory(id: string): Category {
  return load()[id] ?? 'regular';
}

export function setCategory(id: string, cat: Category): void {
  const data = load();
  data[id] = cat;
  save(data);
}

export function removeCategory(id: string): void {
  const data = load();
  delete data[id];
  save(data);
}
