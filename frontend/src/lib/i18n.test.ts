
import { describe, expect, it } from 'vitest';
import { LANGUAGE_META, translateUiText } from './i18n';

describe('localization', () => {
  it('translates core navigation into Dari', () => {
    expect(translateUiText('Dashboard', 'da')).toBe('داشبورد');
    expect(translateUiText('Patients', 'da')).toBe('مریضان');
    expect(translateUiText('User Management', 'da')).toBe('مدیریت کاربران');
    expect(LANGUAGE_META.da.dir).toBe('rtl');
  });

  it('translates core navigation into Pashto', () => {
    expect(translateUiText('Dashboard', 'ps')).toBe('ډشبورډ');
    expect(translateUiText('Patients', 'ps')).toBe('ناروغان');
    expect(translateUiText('User Management', 'ps')).toBe('د کاروونکو مدیریت');
    expect(LANGUAGE_META.ps.dir).toBe('rtl');
  });

  it('leaves English unchanged and LTR', () => {
    expect(translateUiText('Dashboard', 'en')).toBe('Dashboard');
    expect(LANGUAGE_META.en.dir).toBe('ltr');
  });

  it('translates common legacy phrases through the migration fallback', () => {
    expect(translateUiText('Failed to load inventory', 'da')).not.toBe('Failed to load inventory');
    expect(translateUiText('Failed to load inventory', 'ps')).not.toBe('Failed to load inventory');
  });
});
