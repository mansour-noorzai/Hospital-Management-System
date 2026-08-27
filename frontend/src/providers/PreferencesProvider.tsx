
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { LANGUAGE_META, type Language, translateUiText } from '@/lib/i18n';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import { getSocket } from '@/lib/socket';

export type Theme = 'light' | 'dark';

interface PreferencesContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  dir: 'ltr' | 'rtl';
  tr: (text: string) => string;
  hospital?: HospitalBranding;
}

export interface HospitalBranding {
  _id: string; name: string; systemName: string; shortName: string; logoUrl?: string; faviconUrl?: string;
  primaryColor: string; accentColor: string; defaultLanguage: Language; defaultTheme: Theme; currency: string; timezone: string; dateFormat: string;
  address?: string; phone?: string; email?: string; website?: string; registrationNumber?: string;
  invoiceFooter?: string; prescriptionFooter?: string;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function hexToHslValue(hex: string): string | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  const red = ((value >> 16) & 255) / 255;
  const green = ((value >> 8) & 255) / 255;
  const blue = (value & 255) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

function getInitialLanguage(): Language {
  const stored = localStorage.getItem('hms-language');
  return stored === 'da' || stored === 'ps' || stored === 'en' ? stored : 'en';
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('hms-theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const user = useAppSelector(state => state.auth.user);
  const queryClient = useQueryClient();
  const { data: hospital } = useQuery<HospitalBranding>({
    queryKey: ['hospital', 'branding', user?.hospitalId ?? 'public'],
    queryFn: () => api.get(user ? '/hospital/branding' : '/hospital/public').then(response => response.data.data),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const hospitalLanguageInitialized = useRef(false);
  const hospitalThemeInitialized = useRef(false);
  const preferencesInitializedForUser = useRef<string | null>(null);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    localStorage.setItem('hms-language', next);
    if (user) void api.patch('/auth/preferences', { preferredLanguage: next });
  }, [user]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem('hms-theme', next);
    if (user) void api.patch('/auth/preferences', { preferredTheme: next });
  }, [user]);

  useEffect(() => {
    if (user && preferencesInitializedForUser.current !== user._id) {
      if (user.preferredLanguage) setLanguageState(user.preferredLanguage);
      else if (!localStorage.getItem('hms-language') && hospital?.defaultLanguage) setLanguageState(hospital.defaultLanguage);

      if (user.preferredTheme) setThemeState(user.preferredTheme);
      else if (!localStorage.getItem('hms-theme') && hospital?.defaultTheme) setThemeState(hospital.defaultTheme);

      preferencesInitializedForUser.current = user._id;
      hospitalLanguageInitialized.current = true;
      hospitalThemeInitialized.current = true;
      return;
    }

    if (!user && !hospitalLanguageInitialized.current && !localStorage.getItem('hms-language') && hospital?.defaultLanguage) {
      setLanguageState(hospital.defaultLanguage);
      hospitalLanguageInitialized.current = true;
    }
    if (!user && !hospitalThemeInitialized.current && !localStorage.getItem('hms-theme') && hospital?.defaultTheme) {
      setThemeState(hospital.defaultTheme);
      hospitalThemeInitialized.current = true;
    }
  }, [hospital?.defaultLanguage, hospital?.defaultTheme, user]);

  useEffect(() => {
    if (!hospital) return;
    document.title = hospital.systemName;
    document.documentElement.style.setProperty('--hospital-primary', hospital.primaryColor);
    document.documentElement.style.setProperty('--hospital-accent', hospital.accentColor);
    const primary = hexToHslValue(hospital.primaryColor);
    const accent = hexToHslValue(hospital.accentColor);
    if (primary) {
      document.documentElement.style.setProperty('--primary', primary);
      document.documentElement.style.setProperty('--ring', primary);
    }
    if (accent) document.documentElement.style.setProperty('--accent', accent);
    if (hospital.faviconUrl) {
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = hospital.faviconUrl;
    }
  }, [hospital]);

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    const handler = (payload: { hospital?: HospitalBranding }) => {
      if (payload.hospital) queryClient.setQueryData(['hospital', 'branding', user.hospitalId], payload.hospital);
      void queryClient.invalidateQueries({ queryKey: ['hospital'] });
    };
    socket.on('hospital.settings.updated', handler);
    return () => { socket.off('hospital.settings.updated', handler); };
  }, [queryClient, user]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = LANGUAGE_META[language].dir;
    root.dataset.language = language;
  }, [language]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
  }, [theme]);

  const tr = useCallback((text: string) => translateUiText(text, language), [language]);

  const value = useMemo<PreferencesContextValue>(() => ({
    language,
    setLanguage,
    theme,
    setTheme,
    toggleTheme,
    dir: LANGUAGE_META[language].dir,
    tr,
    hospital,
  }), [language, setLanguage, theme, setTheme, toggleTheme, tr, hospital]);

  return (
    <PreferencesContext.Provider value={value}>
      {children}
      <LocalizationBridge language={language} />
    </PreferencesContext.Provider>
  );
}

// The provider and its colocated hook intentionally share the same module.
// eslint-disable-next-line react-refresh/only-export-components
export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider');
  return value;
}

const originalText = new WeakMap<Text, string>();
const lastTranslatedText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Record<string, string>>();
const lastTranslatedAttributes = new WeakMap<Element, Record<string, string>>();

function translateNode(node: Node, language: Language) {
  if (node.nodeType === Node.TEXT_NODE) {
    const textNode = node as Text;
    const parent = textNode.parentElement;
    if (!parent || ['SCRIPT', 'STYLE', 'CODE', 'PRE'].includes(parent.tagName)) return;

    const current = textNode.data;
    const previousOriginal = originalText.get(textNode);
    const previousTranslated = lastTranslatedText.get(textNode);
    let original = previousOriginal ?? current;

    // React may reuse a text node when API data changes. In that case, treat the
    // newly rendered value as the new source instead of restoring stale content.
    if (previousOriginal !== undefined && previousTranslated !== undefined && current !== previousTranslated && current !== previousOriginal) {
      original = current;
    }
    originalText.set(textNode, original);

    const translated = translateUiText(original, language);
    lastTranslatedText.set(textNode, translated);
    if (current !== translated) textNode.data = translated;
    return;
  }

  if (!(node instanceof Element)) return;
  if (['SCRIPT', 'STYLE', 'CODE', 'PRE'].includes(node.tagName)) return;

  const attrs = ['placeholder', 'title', 'aria-label'];
  let stored = originalAttributes.get(node) ?? {};
  const previousTranslated = lastTranslatedAttributes.get(node) ?? {};
  const nextTranslated: Record<string, string> = {};

  for (const attr of attrs) {
    const current = node.getAttribute(attr);
    if (!current) continue;
    if (!stored[attr] || (previousTranslated[attr] && current !== previousTranslated[attr] && current !== stored[attr])) {
      stored[attr] = current;
    }
    const translated = translateUiText(stored[attr], language);
    nextTranslated[attr] = translated;
    if (current !== translated) node.setAttribute(attr, translated);
  }
  originalAttributes.set(node, stored);
  lastTranslatedAttributes.set(node, nextTranslated);

  for (const child of Array.from(node.childNodes)) translateNode(child, language);
}

function LocalizationBridge({ language }: { language: Language }) {
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;

    translateNode(root, language);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const added of Array.from(mutation.addedNodes)) translateNode(added, language);
        if (mutation.type === 'characterData') translateNode(mutation.target, language);
      }
    });

    observer.observe(root, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);

  return null;
}
