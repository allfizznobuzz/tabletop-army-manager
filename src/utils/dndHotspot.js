// Centralized DnD attach hotspot logic
// Computes whether the pointer (px, py) is inside the attach hotspot for a given card rect
// The hotspot is dynamic based on roles (dragged is leader vs non-leader, and whether the target is a leader)

/**
 * @typedef {Object} HotspotOptions
 * @property {boolean} draggedIsLeader
 * @property {boolean} candidateIsLeader
 * @property {('hover'|'drop')} [mode]
 */

/**
 * Clamp a value between min and max
 */
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/**
 * Whether the pointer is in the attach hotspot of the card.
 * - We reserve vertical edge bands for reordering (top/bottom), not for attach.
 * - Horizontal margins must be respected to avoid capturing while near edges.
 * - When dragging a non-leader onto a leader, we tighten the hotspot to the lower-center band
 *   to reduce accidental capture when trying to insert above the leader.
 * @param {number} px
 * @param {number} py
 * @param {{top:number,bottom:number,left:number,right:number}} r
 * @param {HotspotOptions} opts
 */
export function inAttachHotspot(px, py, r, opts) {
  const { draggedIsLeader, candidateIsLeader, mode = "hover" } = opts || {};
  if (!r) return false;
  const height = r.bottom - r.top;
  const width = r.right - r.left;

  // Vertical edge bands reserved for reorder (small to avoid push-away)
  const edgePx = clamp(height * 0.1, 10, 16);
  const inTopEdge = py <= r.top + edgePx;
  const inBottomEdge = py >= r.bottom - edgePx;
  const inHotY = !(inTopEdge || inBottomEdge);

  // Base horizontal band for hotspot (center area)
  const leftMargin = width * 0.3; // 30% margins => center 40%
  const rightMargin = width * 0.3;
  const inHotX = px >= r.left + leftMargin && px <= r.right - rightMargin;

  let inside = inHotX && inHotY;

  // Special tightening: non-leader dragged onto leader target must be in lower-center band
  if (!draggedIsLeader && candidateIsLeader) {
    const lowerTop = r.top + height * 0.6; // bottom 40%
    const lowerBottom = r.bottom - clamp(height * 0.15, 16, 28);
    const tightLeft = r.left + width * 0.4; // center 20% width
    const tightRight = r.right - width * 0.4;
    const inLower = py >= lowerTop && py <= lowerBottom;
    const inTightX = px >= tightLeft && px <= tightRight;
    inside = inLower && inTightX;
  }

  return !!inside;
}

/**
 * Deep center freeze zone to stabilize hover target without being sticky.
 * This is a smaller region than the attach hotspot.
 */
export function inDeepFreezeZone(px, py, r) {
  if (!r) return false;
  const height = r.bottom - r.top;
  const width = r.right - r.left;
  const deepLeft = r.left + width * 0.4;
  const deepRight = r.right - width * 0.4;
  const deepTop = r.top + height * 0.45;
  const deepBottom = r.bottom - height * 0.45;
  return px >= deepLeft && px <= deepRight && py >= deepTop && py <= deepBottom;
}

/**
 * Pre-freeze zone: wider than attach hotspot, used to stabilize a target card
 * so it doesn't slide away while approaching the strict hotspot.
 * - Main goal: when dragging a non-leader onto a leader, freeze in lower-center band earlier.
 */
export function inPreFreezeZone(px, py, r, opts) {
  const { draggedIsLeader, candidateIsLeader } = opts || {};
  if (!r) return false;
  const height = r.bottom - r.top;
  const width = r.right - r.left;

  if (!draggedIsLeader && candidateIsLeader) {
    // Lower-center, looser than attach: x center 40%, y between 55%..85%
    const left = r.left + width * 0.3;
    const right = r.right - width * 0.3;
    const top = r.top + height * 0.55;
    const bottom = r.top + height * 0.85;
    return px >= left && px <= right && py >= top && py <= bottom;
  }

  // Leader -> unit: pre-freeze ~same as hotspot (center band), no need to widen.
  const edgePx = clamp(height * 0.1, 10, 16);
  const inTopEdge = py <= r.top + edgePx;
  const inBottomEdge = py >= r.bottom - edgePx;
  const inHotY = !(inTopEdge || inBottomEdge);
  const inHotX = px >= r.left + width * 0.3 && px <= r.right - width * 0.3;
  return inHotX && inHotY;
}
