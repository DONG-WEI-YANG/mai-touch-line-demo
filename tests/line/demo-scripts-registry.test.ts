import { describe, it, expect } from 'vitest';
import { SCRIPTS, listScripts, getScript } from '../../src/server/line/demo-scripts';

describe('demo scripts registry', () => {
  it('exports 4 scripts', () => {
    expect(Object.keys(SCRIPTS).sort()).toEqual(['complaint','facility','repair','visitor']);
  });
  it('listScripts returns all 4', () => {
    expect(listScripts()).toHaveLength(4);
  });
  it('getScript returns matched script or undefined', () => {
    expect(getScript('facility')?.id).toBe('facility');
    expect(getScript('nonexistent')).toBeUndefined();
  });
  it('every script has localized title for all 3 langs', () => {
    for (const s of listScripts()) {
      expect(s.title['zh-TW']).toBeTruthy();
      expect(s.title['en']).toBeTruthy();
      expect(s.title['ja']).toBeTruthy();
    }
  });
  it('every script has at least one bot_say and one terminal step', () => {
    for (const s of listScripts()) {
      expect(s.steps.length).toBeGreaterThanOrEqual(3);
      expect(s.steps.some(st => st.kind === 'bot_say')).toBe(true);
    }
  });
});
