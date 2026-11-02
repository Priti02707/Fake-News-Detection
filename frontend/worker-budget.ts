// One expensive recognition/comparison job per page. No hidden unbounded queue.
let active: symbol | null = null;
export function reserveBrowserModel(): (() => void) | null {
  if (active) return null;
  const owner = Symbol("model-job"); active = owner;
  return () => { if (active === owner) active = null; };
}
