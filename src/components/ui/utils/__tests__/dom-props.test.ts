import { toDomProps } from '../dom-props';

describe('toDomProps', () => {
  it('maps testID to data-testid and drops React Native only props', () => {
    const result = toDomProps({ testID: 'card', numberOfLines: 2, accessibilityLabel: 'x', title: 'kept' } as Record<string, unknown>);

    expect(result).toEqual({ 'data-testid': 'card', title: 'kept' });
  });

  it('flattens a React Native style array into one style object', () => {
    const result = toDomProps({ style: [{ color: 'red' }, false, null, { fontWeight: 'bold', color: 'blue' }] } as Record<string, unknown>) as { style: unknown };

    expect(Array.isArray(result.style)).toBe(false);
    expect(result.style).toEqual({ color: 'blue', fontWeight: 'bold' });
  });

  it('leaves a plain style object as it is', () => {
    const style = { margin: 4 };
    const result = toDomProps({ style } as Record<string, unknown>) as { style: unknown };

    expect(result.style).toBe(style);
  });
});
