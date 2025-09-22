import React from 'react';
import './UnitDatasheet.css';

const UnitDatasheet = ({ unit, isSelected, onClick }) => {
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
        </div>
      </div>
    </div>
  );
};

export default UnitDatasheet;
