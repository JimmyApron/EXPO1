export type RedactionRect = { x: number; y: number; width: number; height: number };
export type RedactionPoint = { x: number; y: number };

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function redactionRectangle(a: RedactionPoint, b: RedactionPoint): RedactionRect | null {
  if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return null;
  const x = clamp(Math.min(a.x, b.x));
  const y = clamp(Math.min(a.y, b.y));
  const width = clamp(Math.max(a.x, b.x)) - x;
  const height = clamp(Math.max(a.y, b.y)) - y;
  return width > 0.002 && height > 0.002 ? { x, y, width, height } : null;
}

/** Layout hints only, not face/name detection. All coordinates are image-relative. */
export const suggestedRedactions: RedactionRect[] = [
  { x: 0, y: 0, width: 1, height: 0.12 },
  { x: 0, y: 0.12, width: 0.15, height: 0.88 },
];

export function redactionPixels(rect: RedactionRect, width: number, height: number) {
  const left = Math.floor(rect.x * width);
  const top = Math.floor(rect.y * height);
  const right = Math.ceil(Math.round((rect.x + rect.width) * width * 1e9) / 1e9);
  const bottom = Math.ceil(Math.round((rect.y + rect.height) * height * 1e9) / 1e9);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
