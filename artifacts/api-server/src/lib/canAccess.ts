export function canAccess(code: string, tier: number): boolean {
  if (tier >= 2) return true;
  if (tier === 1) return code.length <= 4;
  return code.length <= 3;
}
