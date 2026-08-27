
import type { ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faHouseMedical, faLanguage, faMoon, faShieldHalved, faSun } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/components/ui/button';
import { usePreferences } from '@/providers/PreferencesProvider';
import type { Language } from '@/lib/i18n';

export function AuthShell({ children }: { children: ReactNode }) {
  const { language, setLanguage, theme, toggleTheme, tr, hospital } = usePreferences();

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,hsl(var(--primary)/0.14),transparent_28rem),radial-gradient(circle_at_85%_75%,hsl(var(--accent)/0.10),transparent_30rem)]" />

      <div className="absolute end-4 top-4 z-20 flex items-center gap-2 sm:end-6 sm:top-6">
        <div className="relative">
          <FontAwesomeIcon icon={faLanguage} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" />
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value as Language)}
            className="h-10 rounded-xl border border-input bg-card/90 ps-9 pe-7 text-sm font-medium shadow-sm outline-none backdrop-blur focus:ring-2 focus:ring-ring"
            aria-label={tr('Language')}
          >
            <option value="en">🇬🇧 English</option>
            <option value="da">🇦🇫 دری</option>
            <option value="ps">🇦🇫 پښتو</option>
          </select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-xl bg-card/90 shadow-sm backdrop-blur"
          onClick={toggleTheme}
          aria-label={tr(theme === 'dark' ? 'Light mode' : 'Dark mode')}
        >
          <FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} />
        </Button>
      </div>

      <div className="relative mx-auto grid min-h-dvh max-w-[1500px] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden items-center px-12 lg:flex xl:px-20">
          <div className="max-w-xl">
            <div className="mb-8 inline-flex items-center gap-3 rounded-2xl border border-primary/15 bg-card/70 px-4 py-3 shadow-sm backdrop-blur">
              {hospital?.logoUrl ? <img src={hospital.logoUrl} alt={hospital.name} className="h-11 w-11 rounded-xl object-contain" /> : <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-lg shadow-primary/20"><FontAwesomeIcon icon={faHouseMedical} /></div>}
              <div>
                <p className="font-bold tracking-tight">{hospital?.name ?? 'Hospital'}</p>
                <p className="text-xs text-muted-foreground">{hospital?.systemName ?? tr('Hospital Management System')}</p>
              </div>
            </div>

            <h1 className="text-4xl font-black leading-tight tracking-tight xl:text-5xl">
              {tr('One workspace for clinical, administrative, and patient workflows.')}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
              {tr('Access your hospital workspace securely')}
            </p>

            <div className="mt-9 grid gap-3">
              {[tr('Secure access'), tr('Role-based workflows'), tr('Clinical operations')].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/60 px-4 py-3 text-sm font-medium backdrop-blur">
                  <FontAwesomeIcon icon={faCircleCheck} className="text-emerald-500" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
              <FontAwesomeIcon icon={faShieldHalved} />
              <span>JWT · RBAC · Secure refresh-token rotation</span>
            </div>
          </div>
        </section>

        <main className="flex items-center justify-center px-4 py-24 sm:px-8 lg:px-12">
          <div className="w-full max-w-[520px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
