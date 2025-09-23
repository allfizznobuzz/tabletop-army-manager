import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import UnitDatasheet from '../UnitDatasheet';

function Wrapper() {
  const [overrides, setOverrides] = React.useState({ canLead: 'auto', canBeLed: 'auto', allowList: [] });
  const unit = { id: 'u1', name: 'Test Unit', weapons: [], abilities: [], rules: [], keywords: [] };
  const allUnits = [unit, { id: 'u2', name: 'Other Unit' }];

  return (
    <UnitDatasheet
      unit={unit}
      isSelected
      onClick={() => {}}
      overrides={overrides}
      allUnits={allUnits}
      onUpdateOverrides={(partial) => setOverrides((prev) => ({ ...prev, ...partial }))}
    />
  );
}

describe('UnitDatasheet Override panel', () => {
  test('shows header "Override" and status Off by default', () => {
    render(<Wrapper />);
    // Expand panel
    const header = screen.getByRole('button', { name: /override/i });
    expect(header).toBeInTheDocument();
    fireEvent.click(header);
    expect(screen.getByText(/Override/i)).toBeInTheDocument();
    expect(screen.getByText(/Off/i)).toBeInTheDocument();
  });

  test('no search input is visible and select+add exists', () => {
    render(<Wrapper />);
    const header = screen.getByRole('button', { name: /override/i });
    fireEvent.click(header);

    // Ensure no search textbox
    expect(screen.queryByPlaceholderText(/Search units/i)).not.toBeInTheDocument();

    // Ensure select and Add button exist
    expect(screen.getByRole('combobox', { name: /select unit to allow/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
  });

  test('badge count updates when toggling flags and adding allow', () => {
    render(<Wrapper />);
    const header = screen.getByRole('button', { name: /override/i });
    fireEvent.click(header);

    // Toggle Can lead
    const leadCheckbox = screen.getByLabelText(/Can lead/i, { selector: 'input' });
    fireEvent.click(leadCheckbox);

    // Add allow pairing
    const select = screen.getByRole('combobox', { name: /select unit to allow/i });
    fireEvent.change(select, { target: { value: 'u2' } });
    const addBtn = screen.getByRole('button', { name: /add/i });
    fireEvent.click(addBtn);

    // Badge should show Overridden (2)
    expect(screen.getByText(/Overridden \(2\)/i)).toBeInTheDocument();

    // Reset returns to Off
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(screen.getByText(/Off/i)).toBeInTheDocument();
  });
});
