import { StatusBottomSheet } from '../status-bottom-sheet';

// Simple test to verify that the component is properly exported and can be imported
describe('StatusBottomSheet', () => {
  it('should be importable without error', () => {
    expect(StatusBottomSheet).toBeDefined();
    expect(typeof StatusBottomSheet).toBe('function');
  });
});