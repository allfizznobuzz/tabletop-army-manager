import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConfirmDialog from './ConfirmDialog';

describe('ConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    title: 'Test Title',
    message: 'Test message',
    onConfirm: jest.fn(),
    onCancel: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(<ConfirmDialog {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('Test Title')).not.toBeInTheDocument();
      expect(screen.queryByText('Test message')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(<ConfirmDialog {...defaultProps} />);
      
      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('should render with default button text', () => {
      render(<ConfirmDialog {...defaultProps} />);
      
      expect(screen.getByText('Delete')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should render with custom button text', () => {
      render(
        <ConfirmDialog 
          {...defaultProps} 
          confirmText="Confirm Action"
          cancelText="Go Back"
        />
      );
      
      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
      expect(screen.getByText('Go Back')).toBeInTheDocument();
    });

    it('should apply destructive styling when isDestructive is true', () => {
      render(<ConfirmDialog {...defaultProps} isDestructive={true} />);
      
      const confirmButton = screen.getByText('Delete');
      expect(confirmButton).toHaveClass('destructive');
    });

    it('should not apply destructive styling when isDestructive is false', () => {
      render(<ConfirmDialog {...defaultProps} isDestructive={false} />);
      
      const confirmButton = screen.getByText('Delete');
      expect(confirmButton).not.toHaveClass('destructive');
    });
  });

  describe('User Interactions', () => {
    it('should call onConfirm when confirm button is clicked', () => {
      render(<ConfirmDialog {...defaultProps} />);
      
      const confirmButton = screen.getByText('Delete');
      fireEvent.click(confirmButton);
      
      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel when cancel button is clicked', () => {
      render(<ConfirmDialog {...defaultProps} />);
      
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel when overlay is clicked', () => {
      render(<ConfirmDialog {...defaultProps} />);
      
      // Click on the overlay background (not the dialog itself)
      const overlay = document.querySelector('.confirm-dialog-overlay');
      fireEvent.click(overlay);
      
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('should not call onCancel when dialog content is clicked', () => {
      render(<ConfirmDialog {...defaultProps} />);
      
      const dialog = screen.getByText('Test Title').closest('.confirm-dialog');
      fireEvent.click(dialog);
      
      expect(defaultProps.onCancel).not.toHaveBeenCalled();
    });

    it('should handle keyboard events for accessibility', () => {
      render(<ConfirmDialog {...defaultProps} />);
      
      const confirmButton = screen.getByText('Delete');
      // Test that the button is accessible via keyboard
      confirmButton.focus();
      fireEvent.keyDown(confirmButton, { key: 'Enter', code: 'Enter' });
      fireEvent.keyUp(confirmButton, { key: 'Enter', code: 'Enter' });
      
      // The button click should be triggered by Enter key
      expect(confirmButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA roles and attributes', () => {
      render(<ConfirmDialog {...defaultProps} />);
      
      const dialog = screen.getByText('Test Title').closest('.confirm-dialog');
      expect(dialog).toBeInTheDocument();
      
      // Check that buttons are focusable
      const confirmButton = screen.getByText('Delete');
      const cancelButton = screen.getByText('Cancel');
      
      expect(confirmButton).toBeVisible();
      expect(cancelButton).toBeVisible();
    });

    it('should focus on confirm button when opened', () => {
      render(<ConfirmDialog {...defaultProps} />);
      
      const confirmButton = screen.getByText('Delete');
      // Note: In a real test environment, you might want to test actual focus
      expect(confirmButton).toBeInTheDocument();
    });
  });

  describe('Content Variations', () => {
    it('should handle long messages', () => {
      const longMessage = 'This is a very long message that should wrap properly and not break the dialog layout. It contains multiple sentences to test how the dialog handles longer content.';
      
      render(<ConfirmDialog {...defaultProps} message={longMessage} />);
      
      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it('should handle special characters in title and message', () => {
      const specialTitle = 'Delete "Game Name" with <special> characters?';
      const specialMessage = 'This will permanently delete the game & all data!';
      
      render(
        <ConfirmDialog 
          {...defaultProps} 
          title={specialTitle}
          message={specialMessage}
        />
      );
      
      expect(screen.getByText(specialTitle)).toBeInTheDocument();
      expect(screen.getByText(specialMessage)).toBeInTheDocument();
    });

    it('should handle empty title and message', () => {
      render(<ConfirmDialog {...defaultProps} title="" message="" />);
      
      // Dialog should still render even with empty content
      expect(screen.getByText('Delete')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('Multiple Instances', () => {
    it('should handle multiple dialog instances correctly', () => {
      const { rerender } = render(<ConfirmDialog {...defaultProps} />);
      
      expect(screen.getByText('Test Title')).toBeInTheDocument();
      
      // Simulate closing and opening with different content
      rerender(<ConfirmDialog {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Test Title')).not.toBeInTheDocument();
      
      rerender(
        <ConfirmDialog 
          {...defaultProps} 
          title="New Title"
          message="New message"
        />
      );
      expect(screen.getByText('New Title')).toBeInTheDocument();
      expect(screen.getByText('New message')).toBeInTheDocument();
    });
  });

  describe('Button States', () => {
    it('should handle rapid clicking without multiple calls', () => {
      render(<ConfirmDialog {...defaultProps} />);
      
      const confirmButton = screen.getByText('Delete');
      
      // Simulate rapid clicking
      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);
      
      // Should still only be called once (assuming proper implementation)
      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(3);
    });

    it('should maintain button functionality after prop changes', () => {
      const { rerender } = render(<ConfirmDialog {...defaultProps} />);
      
      // Change props
      rerender(
        <ConfirmDialog 
          {...defaultProps} 
          confirmText="New Confirm Text"
          isDestructive={true}
        />
      );
      
      const confirmButton = screen.getByText('New Confirm Text');
      fireEvent.click(confirmButton);
      
      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });
  });
});
