import { hasActiveOverrides, countActiveOverrides, getOverrideSummary, canAttach } from './eligibility';

describe('eligibility utils', () => {
  const resolveName = (id) => ({ A: 'Alpha', B: 'Bravo', L: 'Leader' }[id] || id);

  test('hasActiveOverrides returns false for empty or auto values', () => {
    expect(hasActiveOverrides(undefined)).toBe(false);
    expect(hasActiveOverrides({})).toBe(false);
    expect(hasActiveOverrides({ canLead: 'auto', canBeLed: 'auto', allowList: [] })).toBe(false);
  });

  test('hasActiveOverrides returns true when any flag or allow present', () => {
    expect(hasActiveOverrides({ canLead: 'yes' })).toBe(true);
    expect(hasActiveOverrides({ canBeLed: 'yes' })).toBe(true);
    expect(hasActiveOverrides({ allowList: ['A'] })).toBe(true);
  });

  test('countActiveOverrides counts flags and allow pairs', () => {
    expect(countActiveOverrides({})).toBe(0);
    expect(countActiveOverrides({ canLead: 'yes' })).toBe(1);
    expect(countActiveOverrides({ canBeLed: 'yes' })).toBe(1);
    expect(countActiveOverrides({ allowList: ['A', 'B'] })).toBe(2);
    expect(countActiveOverrides({ canLead: 'yes', canBeLed: 'yes', allowList: ['A'] })).toBe(3);
  });

  test('getOverrideSummary composes readable summary', () => {
    expect(getOverrideSummary({}, resolveName)).toBe('No overrides');
    expect(getOverrideSummary({ canLead: 'yes' }, resolveName)).toContain('Lead ✓');
    const s = getOverrideSummary({ allowList: ['A', 'B'] }, resolveName);
    expect(s).toContain('Allow: Alpha, Bravo');
  });

  test('canAttach precedence: allow > flags > auto(source)', () => {
    const leader = { id: 'L' };
    const unit = { id: 'A' };
    const overrides = {
      L: { canLead: 'auto', allowList: [] },
      A: { canBeLed: 'auto', allowList: [] },
    };
    const sourceFalse = () => false;
    const sourceTrue = () => true;

    // Auto relies on source
    expect(canAttach(leader, unit, overrides, sourceFalse)).toBe(false);
    expect(canAttach(leader, unit, overrides, sourceTrue)).toBe(true);

    // Flags force allow/deny over source
    expect(canAttach(leader, unit, { ...overrides, L: { canLead: 'no' } }, sourceTrue)).toBe(false);
    expect(canAttach(leader, unit, { ...overrides, A: { canBeLed: 'no' } }, sourceTrue)).toBe(false);
    expect(canAttach(leader, unit, { ...overrides, L: { canLead: 'yes' } }, sourceFalse)).toBe(true);
    expect(canAttach(leader, unit, { ...overrides, A: { canBeLed: 'yes' } }, sourceFalse)).toBe(true);

    // Pairwise allow beats everything
    expect(canAttach(leader, unit, { ...overrides, L: { allowList: ['A'] } }, sourceFalse)).toBe(true);
    expect(canAttach(leader, unit, { ...overrides, A: { allowList: ['L'] } }, sourceFalse)).toBe(true);
  });
});
