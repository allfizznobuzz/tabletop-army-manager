import React, { useMemo, useState } from 'react';
import './UnitDatasheet.css';

const UnitDatasheet = ({ unit, isSelected, onClick, overrides, allUnits = [], onUpdateOverrides }) => {
  if (!unit) return null;

  // Separate weapons by type
  const rangedWeapons = unit.weapons?.filter(weapon => 
    weapon.type !== 'Melee' && weapon.range !== 'Melee'
  ) || [];
  
  const meleeWeapons = unit.weapons?.filter(weapon => 
    weapon.type === 'Melee' || weapon.range === 'Melee'
  ) || [];

  // Get unit stats for header
  const getStatValue = (stat, defaultValue = '-') => {
    return stat !== undefined ? `${stat}+` : defaultValue;
  };

  return (
    <div 
      className={`unit-datasheet ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      {/* Unit Header */}
      <div className="datasheet-header">
        <div className="unit-title">
          <h2>{unit.name}</h2>
          <div className="unit-size">{unit.models} {unit.models === 1 ? 'model' : 'models'}</div>
        </div>
        
        {/* Unit Stats */}
        <div className="unit-stats-row">
          <div className="stat-box">
            <div className="stat-label">M</div>
            <div className="stat-value">12"</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">T</div>
            <div className="stat-value">{unit.toughness || 4}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Sv</div>
            <div className="stat-value">{getStatValue(unit.armor_save, '3+')}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">W</div>
            <div className="stat-value">{unit.wounds || 1}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Ld</div>
            <div className="stat-value">6+</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">OC</div>
            <div className="stat-value">1</div>
          </div>
        </div>
      </div>

      <div className="datasheet-content">
        {/* Ranged Weapons */}
        {rangedWeapons.length > 0 && (
          <div className="weapons-section">
            <div className="section-header ranged-header">
              <span className="weapon-icon">🎯</span>
              <span>RANGED WEAPONS</span>
            </div>
            <div className="weapons-table">
              <div className="weapons-table-header">
                <div className="weapon-name-col">WEAPON</div>
                <div className="weapon-stat-col">RANGE</div>
                <div className="weapon-stat-col">A</div>
                <div className="weapon-stat-col">BS</div>
                <div className="weapon-stat-col">S</div>
                <div className="weapon-stat-col">AP</div>
                <div className="weapon-stat-col">D</div>
              </div>
              {rangedWeapons.map((weapon, index) => (
                <div key={index} className="weapon-row">
                  <div className="weapon-name-col">
                    <div className="weapon-name">{weapon.name}</div>
                    {weapon.count > 1 && <div className="weapon-count">(x{weapon.count})</div>}
                  </div>
                  <div className="weapon-stat-col">{weapon.range}</div>
                  <div className="weapon-stat-col">{weapon.attacks}</div>
                  <div className="weapon-stat-col">{getStatValue(weapon.skill, '3+')}</div>
                  <div className="weapon-stat-col">{weapon.strength}</div>
                  <div className="weapon-stat-col">{weapon.ap}</div>
                  <div className="weapon-stat-col">{weapon.damage}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Melee Weapons */}
        {meleeWeapons.length > 0 && (
          <div className="weapons-section">
            <div className="section-header melee-header">
              <span className="weapon-icon">⚔️</span>
              <span>MELEE WEAPONS</span>
            </div>
            <div className="weapons-table">
              <div className="weapons-table-header">
                <div className="weapon-name-col">WEAPON</div>
                <div className="weapon-stat-col">RANGE</div>
                <div className="weapon-stat-col">A</div>
                <div className="weapon-stat-col">WS</div>
                <div className="weapon-stat-col">S</div>
                <div className="weapon-stat-col">AP</div>
                <div className="weapon-stat-col">D</div>
              </div>
              {meleeWeapons.map((weapon, index) => (
                <div key={index} className="weapon-row">
                  <div className="weapon-name-col">
                    <div className="weapon-name">{weapon.name}</div>
                    {weapon.count > 1 && <div className="weapon-count">(x{weapon.count})</div>}
                  </div>
                  <div className="weapon-stat-col">Melee</div>
                  <div className="weapon-stat-col">{weapon.attacks}</div>
                  <div className="weapon-stat-col">{getStatValue(weapon.skill, '3+')}</div>
                  <div className="weapon-stat-col">{weapon.strength}</div>
                  <div className="weapon-stat-col">{weapon.ap}</div>
                  <div className="weapon-stat-col">{weapon.damage}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="datasheet-bottom">
          {/* Abilities */}
          {unit.abilities && unit.abilities.length > 0 && (
            <div className="abilities-section">
              <div className="section-header abilities-header">ABILITIES</div>
              <div className="abilities-content">
                {unit.abilities.map((ability, index) => (
                  <div key={index} className="ability-item">
                    <div className="ability-name">{ability.name}:</div>
                    <div className="ability-description">{ability.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unit Composition */}
          {unit.modelGroups && unit.modelGroups.length > 0 && (
            <div className="composition-section">
              <div className="section-header composition-header">UNIT COMPOSITION</div>
              <div className="composition-content">
                {unit.modelGroups.map((group, index) => (
                  <div key={index} className="composition-item">
                    • {group.count}x {group.name}
                  </div>
                ))}
                <div className="points-cost">{unit.models} models - {unit.points} pts</div>
              </div>
            </div>
          )}

          {/* Keywords */}
          {unit.keywords && unit.keywords.length > 0 && (
            <div className="keywords-section">
              <div className="keywords-header">
                <span className="keywords-label">KEYWORDS:</span>
                <span className="keywords-list">
                  {unit.keywords.join(', ').toUpperCase()}
                </span>
              </div>
            </div>
          )}

          {/* Leadership Overrides - Compact Collapsible */}
          <OverridesCollapsible
            unit={unit}
            overrides={overrides}
            allUnits={allUnits}
            onUpdateOverrides={onUpdateOverrides}
          />
        </div>
      </div>
    </div>
  );
};

const OverridesCollapsible = ({ unit, overrides, allUnits, onUpdateOverrides }) => {
  const [open, setOpen] = useState(false);

  const activeCount = useMemo(() => {
    let n = 0;
    if (overrides?.canLead && overrides.canLead !== 'auto') n += 1;
    if (overrides?.canBeLed && overrides.canBeLed !== 'auto') n += 1;
    n += (overrides?.allowList?.length || 0);
    return n;
  }, [overrides]);

  const statusText = activeCount > 0 ? `Overridden (${activeCount})` : 'Off';
  const statusClass = activeCount > 0 ? 'overridden' : 'off';

  const onToggleLead = (checked) => {
    onUpdateOverrides?.({ canLead: checked ? 'yes' : 'auto' });
  };
  const onToggleLed = (checked) => {
    onUpdateOverrides?.({ canBeLed: checked ? 'yes' : 'auto' });
  };

  const onReset = () => {
    onUpdateOverrides?.({ canLead: 'auto', canBeLed: 'auto', allowList: [], blockList: [] });
  };

  return (
    <div className="overrides-collapsible">
      <button type="button" className="overrides-header" onClick={() => setOpen(!open)}>
        <span className={`chevron ${open ? 'open' : ''}`}>▸</span>
        <span>Override</span>
        <span className={`status-chip ${statusClass}`}>{statusText}</span>
      </button>
      {open && (
        <div className="overrides-panel">
          <div className="flags-row" role="group" aria-label="Override flags">
            <label className="flag-item" aria-label="Can lead">
              <input
                type="checkbox"
                checked={overrides?.canLead === 'yes'}
                onChange={(e) => onToggleLead(e.target.checked)}
              />
              <span>Can lead</span>
            </label>
            <label className="flag-item" aria-label="Can be led">
              <input
                type="checkbox"
                checked={overrides?.canBeLed === 'yes'}
                onChange={(e) => onToggleLed(e.target.checked)}
              />
              <span>Can be led</span>
            </label>
          </div>

          <PairwiseControls
            unit={unit}
            allUnits={allUnits}
            overrides={overrides}
            onUpdateOverrides={onUpdateOverrides}
          />

          <div className="override-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onReset}
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const PairwiseControls = ({ unit, allUnits, overrides, onUpdateOverrides }) => {
  const [allowSelect, setAllowSelect] = useState('');
  const [allowQuery, setAllowQuery] = useState('');
  const unitOptions = useMemo(() => {
    return allUnits.filter(u => u.id !== unit.id).map(u => ({ id: u.id, name: u.name }));
  }, [allUnits, unit.id]);

  const filteredAllow = useMemo(() => {
    const q = allowQuery.trim().toLowerCase();
    return q ? unitOptions.filter(o => o.name.toLowerCase().includes(q)) : unitOptions;
  }, [allowQuery, unitOptions]);

  const addAllow = () => {
    if (!allowSelect) return;
    const next = Array.from(new Set([...(overrides?.allowList || []), allowSelect]));
    onUpdateOverrides?.({ allowList: next });
    setAllowSelect('');
  };
  const removeAllow = (id) => {
    const next = (overrides?.allowList || []).filter(x => x !== id);
    onUpdateOverrides?.({ allowList: next });
  };

  return (
    <div className="pairwise-overrides single">
      <div className="pair-column" aria-label="Allow specific pairings">
        <label htmlFor="allow-search">Allow specific pairings</label>
        <div className="pair-search-row">
          <input
            id="allow-search"
            type="text"
            placeholder="Search units…"
            value={allowQuery}
            onChange={(e) => setAllowQuery(e.target.value)}
          />
        </div>
        <div className="pair-add-row">
          <select aria-label="Select unit to allow" value={allowSelect} onChange={(e) => setAllowSelect(e.target.value)}>
            <option value="">Select a unit…</option>
            {filteredAllow.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.name}</option>
            ))}
          </select>
          <button type="button" className="btn-primary" onClick={addAllow}>Add</button>
        </div>
        <div className="chips" aria-label="Allowed list">
          {(overrides?.allowList || []).map(id => {
            const u = allUnits.find(x => x.id === id);
            return (
              <span key={id} className="chip">
                {u ? u.name : id}
                <button type="button" aria-label={`Remove ${u ? u.name : id} from allow list`} onClick={() => removeAllow(id)}>×</button>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default UnitDatasheet;
