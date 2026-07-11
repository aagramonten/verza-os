import { describe, expect, it } from 'vitest';
import { emptyCollected } from '../../src/modules/chat/application/collected-project.js';
import {
  confirmAllPresent,
  mergeExtraction,
} from '../../src/modules/chat/application/merge-policy.js';

describe('merge policy', () => {
  it('fills empty fields', () => {
    const result = mergeExtraction(emptyCollected(), {
      customerName: 'Ángel',
      municipality: 'Bayamón',
    });
    expect(result.applied.sort()).toEqual(['customerName', 'municipality']);
    expect(result.next.fields['customerName']).toBe('Ángel');
    expect(result.contradictions).toHaveLength(0);
  });

  it('treats an equal value as a no-op', () => {
    const current = { fields: { municipality: 'Bayamón' }, confirmed: [] };
    const result = mergeExtraction(current, { municipality: 'bayamón' });
    expect(result.applied).toHaveLength(0);
    expect(result.contradictions).toHaveLength(0);
  });

  it('does not silently overwrite a conflicting unconfirmed value; raises a contradiction', () => {
    const current = { fields: { municipality: 'Bayamón' }, confirmed: [] };
    const result = mergeExtraction(current, { municipality: 'Caguas' });
    expect(result.next.fields['municipality']).toBe('Bayamón'); // unchanged
    expect(result.contradictions).toEqual([
      { field: 'municipality', existingValue: 'Bayamón', newValue: 'Caguas' },
    ]);
    expect(result.applied).not.toContain('municipality');
  });

  it('never overwrites a confirmed field', () => {
    const current = { fields: { municipality: 'Bayamón' }, confirmed: ['municipality'] };
    const result = mergeExtraction(current, { municipality: 'Caguas' });
    expect(result.next.fields['municipality']).toBe('Bayamón');
    expect(result.rejected).toContain('municipality');
    expect(result.contradictions).toHaveLength(0);
  });

  it('merges array fields by union without contradictions', () => {
    const current = { fields: { stylePreferences: ['moderno'] }, confirmed: [] };
    const result = mergeExtraction(current, { stylePreferences: ['moderno', 'tropical'] });
    expect(result.next.fields['stylePreferences']).toEqual(['moderno', 'tropical']);
    expect(result.contradictions).toHaveLength(0);
  });

  it('does not mutate the input state', () => {
    const current = emptyCollected();
    mergeExtraction(current, { phone: '+17875551234' });
    expect(current.fields).toEqual({});
  });

  it('confirmAllPresent marks present fields confirmed', () => {
    const state = { fields: { customerName: 'Ana', phone: '' }, confirmed: [] };
    expect(confirmAllPresent(state).confirmed).toEqual(['customerName']);
  });
});
