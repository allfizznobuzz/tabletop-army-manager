import { inAttachHotspot, inDeepFreezeZone } from "../dndHotspot";

const rect = (left, top, width, height) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

describe("dndHotspot", () => {
  test("leader -> unit: center is attach, edges are not", () => {
    const r = rect(0, 0, 200, 100); // width=200, height=100
    const draggedIsLeader = true;
    const candidateIsLeader = false;

    // center (x=100,y=50) should be attach
    expect(
      inAttachHotspot(100, 50, r, {
        draggedIsLeader,
        candidateIsLeader,
        mode: "hover",
      }),
    ).toBe(true);

    // near top edge (edge band ~40px)
    expect(
      inAttachHotspot(100, 10, r, {
        draggedIsLeader,
        candidateIsLeader,
        mode: "hover",
      }),
    ).toBe(false);

    // near bottom edge
    expect(
      inAttachHotspot(100, 95, r, {
        draggedIsLeader,
        candidateIsLeader,
        mode: "hover",
      }),
    ).toBe(false);

    // near left horizontal margin (35% => 70px)
    expect(
      inAttachHotspot(60, 50, r, {
        draggedIsLeader,
        candidateIsLeader,
        mode: "hover",
      }),
    ).toBe(false);

    // near right horizontal margin
    expect(
      inAttachHotspot(140, 50, r, {
        draggedIsLeader,
        candidateIsLeader,
        mode: "hover",
      }),
    ).toBe(false);
  });

  test("unit -> leader: only lower tight band captures attach", () => {
    const r = rect(0, 0, 200, 100);
    const draggedIsLeader = false;
    const candidateIsLeader = true;

    // mid center should NOT attach (top half)
    expect(
      inAttachHotspot(100, 30, r, {
        draggedIsLeader,
        candidateIsLeader,
        mode: "hover",
      }),
    ).toBe(false);

    // lower tight band center should attach (y in 60..80, x in 80..120)
    expect(
      inAttachHotspot(100, 70, r, {
        draggedIsLeader,
        candidateIsLeader,
        mode: "hover",
      }),
    ).toBe(true);

    // too low
    expect(
      inAttachHotspot(100, 90, r, {
        draggedIsLeader,
        candidateIsLeader,
        mode: "hover",
      }),
    ).toBe(false);

    // too left (tight X 80..120)
    expect(
      inAttachHotspot(75, 70, r, {
        draggedIsLeader,
        candidateIsLeader,
        mode: "hover",
      }),
    ).toBe(false);

    // too right
    expect(
      inAttachHotspot(125, 70, r, {
        draggedIsLeader,
        candidateIsLeader,
        mode: "hover",
      }),
    ).toBe(false);
  });

  test("deep freeze zone is smaller than hotspot", () => {
    const r = rect(0, 0, 200, 100);
    // Deep center
    expect(inDeepFreezeZone(100, 50, r)).toBe(true);
    // Inside hotspot but outside deep center should be false for freeze
    // hotspot x range is 70..130 (when leader->unit); deep is 80..120
    expect(inDeepFreezeZone(75, 50, r)).toBe(false);
    expect(inDeepFreezeZone(125, 50, r)).toBe(false);
    // near top/bottom
    expect(inDeepFreezeZone(100, 30, r)).toBe(false);
    expect(inDeepFreezeZone(100, 90, r)).toBe(false);
  });
});
