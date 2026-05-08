export function canAccess(code: string, tier: number): boolean {
  if (tier >= 2) return true;
  if (tier === 1) return code.length <= 4;
  return code.length <= 3;
}

/**
 * Enforces the tier-based root restriction on top of the length-based canAccess check.
 * Tier >= 4 users start from root "0" and can access the full tree.
 * Tier < 4 users start from root "1" (Ciências only) and must not reach sibling branches
 * such as E, F, or R that live directly under "0" but outside the "1" subtree.
 *
 * Pass a Map built from all nodes: code → { parentCode }.
 * Returns false if the node (or any of its ancestors) is NOT reachable from "1" for tier < 4.
 */
export function isInAllowedSubtree(
  nodeCode: string,
  nodeMap: Map<string, { parentCode: string | null }>,
  tier: number,
): boolean {
  if (tier >= 4) return true;
  let current: string | null = nodeCode;
  while (current !== null) {
    if (current === "1") return true;
    const node = nodeMap.get(current);
    if (!node) break;
    current = node.parentCode;
  }
  return false;
}
