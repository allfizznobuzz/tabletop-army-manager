import { woundTarget, probabilityFromTarget, parseDiceNotation, bestSaveTargetAfterAp, applyApToSave } from '../attackMath';

describe('attackMath.woundTarget', () => {
  test.each([
    [8, 4, 2], // S >= 2T -> 2+
    [5, 4, 3], // S > T -> 3+
    [4, 4, 4], // S = T -> 4+
    [3, 4, 5], // S < T -> 5+
    [2, 5, 6], // S <= T/2 -> 6+
  ])('S=%s vs T=%s => %s+', (S, T, expected) => {
    expect(woundTarget(S, T)).toBe(expected);
  });
});

describe('attackMath.probabilityFromTarget', () => {
  it('maps target to probability clamped correctly', () => {
    expect(probabilityFromTarget(2)).toBeCloseTo(5/6, 5);
    expect(probabilityFromTarget(3)).toBeCloseTo(4/6, 5);
    expect(probabilityFromTarget(6)).toBeCloseTo(1/6, 5);
  });
});

describe('attackMath.parseDiceNotation', () => {
  it('parses fixed numbers', () => {
    const r = parseDiceNotation(5);
    expect(r.kind).toBe('fixed');
    expect(r.value).toBe(5);
  });

  it('parses D3', () => {
    const r = parseDiceNotation('D3');
    expect(r.kind).toBe('dice');
    expect(r.avg).toBeCloseTo(2.0, 5);
    expect(r.min).toBe(1);
    expect(r.max).toBe(3);
  });

  it('parses 2D6', () => {
    const r = parseDiceNotation('2D6');
    expect(r.avg).toBeCloseTo(7.0, 5);
    expect(r.min).toBe(2);
    expect(r.max).toBe(12);
  });

  it('parses D6+1', () => {
    const r = parseDiceNotation('D6+1');
    expect(r.avg).toBeCloseTo(4.5, 5);
    expect(r.min).toBe(2);
    expect(r.max).toBe(7);
  });

  it('parses 2D3+3', () => {
    const r = parseDiceNotation('2D3+3');
    expect(r.avg).toBeCloseTo(7.0, 5);
    expect(r.min).toBe(5);
    expect(r.max).toBe(9);
  });
});

describe('attackMath.saves', () => {
  it('applies AP to armour and selects best vs invuln', () => {
    expect(applyApToSave('3+', -1)).toBe(4);
    expect(bestSaveTargetAfterAp('3+', -1, '5+')).toBe(4);
  });

  it('prefers invuln when armour after AP is worse', () => {
    expect(bestSaveTargetAfterAp('6+', -3, '4+')).toBe(4);
  });
});
