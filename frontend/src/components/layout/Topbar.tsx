import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faLanguage, faMagnifyingGlass, faMoon, faShieldHalved, faSun } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/components/ui/button';
import { useAppSelector } from '@/store/hooks';
import { usePreferences } from '@/providers/PreferencesProvider';
import type { Language } from '@/lib/i18n';
import type { AuthUser } from '@/store/authSlice';

const routeTitles: Array<[RegExp, string]> = [
  [/^\/admin\/patients|^\/patients/, 'Patients'],
  [/^\/admin\/billing/, 'Billing'],
  [/^\/admin\/appointments/, 'Appointments'],
  [/^\/admin\/lab/, 'Lab Management'],
  [/^\/admin\/pharmacy/, 'Pharmacy Management'],
  [/^\/admin\/inventory/, 'Inventory Management'],
  [/^\/admin\/documents/, 'Document Management'],
  [/^\/admin\/analytics/, 'Analytics'],
  [/^\/admin\/settings/, 'Settings'],
  [/^\/admin\/users/, 'User Management'],
  [/^\/admin\/roles/, 'Roles & Permissions'],
  [/^\/admin\/audit-logs/, 'Audit Logs'],
  [/^\/admin\/departments/, 'Departments'],
  [/^\/admin\/staff/, 'Staff'],
  [/^\/profile/, 'My Profile'],
  [/^\/doctor\/schedule/, 'Schedule'],
  [/^\/doctor\/lab/, 'Lab Orders'],
  [/^\/doctor\/prescriptions/, 'Prescriptions'],
  [/^\/doctor\/documents/, 'Documents'],
  [/^\/nurse\/dispensing/, 'Dispensing Queue'],
  [/^\/nurse\/inventory/, 'Inventory'],
  [/^\/patient\/appointments/, 'My Appointments'],
  [/^\/patient\/billing/, 'My Bills'],
  [/^\/patient\/lab/, 'My Lab Results'],
  [/^\/patient\/prescriptions/, 'My Prescriptions'],
  [/^\/patient\/documents/, 'My Documents'],
  [/\/dashboard$/, 'Dashboard'],
];

interface SearchOption {
  label: string;
  path: string;
  roles: Array<AuthUser['role']>;
}

const SEARCH_OPTIONS: SearchOption[] = [
  { label: 'Dashboard', path: '/dashboard', roles: ['admin', 'doctor', 'nurse', 'receptionist', 'patient'] },
  { label: 'My Profile', path: '/profile', roles: ['admin', 'doctor', 'nurse', 'receptionist', 'patient'] },
  { label: 'Patients', path: '/patients', roles: ['admin', 'doctor', 'nurse', 'receptionist'] },
  { label: 'Appointments', path: '/admin/appointments', roles: ['admin', 'receptionist'] },
  { label: 'My Appointments', path: '/patient/appointments', roles: ['patient'] },
  { label: 'Schedule', path: '/doctor/schedule', roles: ['doctor'] },
  { label: 'Billing', path: '/admin/billing', roles: ['admin', 'receptionist'] },
  { label: 'My Bills', path: '/patient/billing', roles: ['patient'] },
  { label: 'Lab Management', path: '/admin/lab', roles: ['admin', 'nurse'] },
  { label: 'Lab Orders', path: '/doctor/lab', roles: ['doctor'] },
  { label: 'My Lab Results', path: '/patient/lab', roles: ['patient'] },
  { label: 'Pharmacy', path: '/admin/pharmacy', roles: ['admin'] },
  { label: 'Dispensing Queue', path: '/nurse/dispensing', roles: ['nurse'] },
  { label: 'Inventory', path: '/admin/inventory', roles: ['admin'] },
  { label: 'Inventory', path: '/nurse/inventory', roles: ['nurse'] },
  { label: 'Analytics', path: '/admin/analytics', roles: ['admin'] },
  { label: 'Users', path: '/admin/users', roles: ['admin'] },
  { label: 'Staff', path: '/admin/staff', roles: ['admin'] },
  { label: 'Departments', path: '/admin/departments', roles: ['admin'] },
  { label: 'Settings', path: '/admin/settings', roles: ['admin'] },
];

function getRouteTitle(pathname: string) {
  return routeTitles.find(([pattern]) => pattern.test(pathname))?.[1] ?? 'Hospital Management System';
}

export function Topbar({ onOpenNavigation }: { onOpenNavigation: () => void }) {
  const user = useAppSelector((state) => state.auth.user);
  const location = useLocation();
  const navigate = useNavigate();
  const { language, setLanguage, theme, toggleTheme, tr, hospital } = usePreferences();
  const [search, setSearch] = useState('');
  const routeTitle = getRouteTitle(location.pathname);
  const title = routeTitle === 'Hospital Management System' ? hospital?.systemName ?? routeTitle : routeTitle;
  const options = useMemo(() => SEARCH_OPTIONS.filter((option) => user && option.roles.includes(user.role)), [user]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = search.trim().toLowerCase();
    if (!normalized) return;
    const match = options.find((option) => option.label.toLowerCase() === normalized)
      ?? options.find((option) => option.label.toLowerCase().includes(normalized));
    if (match) {
      navigate(match.path);
      setSearch('');
    }
  };

  return (
    <header className="z-30 min-h-[78px] border-b border-border/70 bg-card/95 px-4 shadow-[var(--shell-shadow)] backdrop-blur-xl sm:px-5 md:sticky md:top-0 md:rounded-[22px] md:border">
      <div className="flex min-h-[78px] w-full items-center gap-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onOpenNavigation} aria-label="Open navigation">
          <FontAwesomeIcon icon={faBars} />
        </Button>

        <div className="min-w-0 md:hidden">
          <h1 className="truncate text-base font-extrabold tracking-tight">{tr(title)}</h1>
        </div>

        <form onSubmit={handleSearch} className="relative ms-auto hidden w-full max-w-[360px] lg:block">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            list="hms-global-search"
            aria-label={tr('Search modules')}
            placeholder={tr('Search modules...')}
            className="h-11 w-full rounded-full border border-border/80 bg-background/70 ps-11 pe-4 text-sm font-medium outline-none transition placeholder:text-muted-foreground/75 hover:border-primary/25 focus:border-primary/45 focus:bg-card focus:ring-4 focus:ring-primary/10"
          />
          <datalist id="hms-global-search">{options.map((option) => <option key={`${option.path}-${option.label}`} value={tr(option.label)} />)}</datalist>
        </form>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 xl:flex">
            <FontAwesomeIcon icon={faShieldHalved} />
            {tr('Secure access')}
          </span>

          <div className="relative hidden sm:block">
            <FontAwesomeIcon icon={faLanguage} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" />
            <select aria-label={tr('Language')} value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="h-10 rounded-xl border border-input bg-card ps-9 pe-8 text-xs font-bold outline-none transition hover:border-primary/30 focus:ring-2 focus:ring-ring/20">
              <option value="en">🇬🇧 English</option>
              <option value="da">🇦🇫 دری</option>
              <option value="ps">🇦🇫 پښتو</option>
            </select>
          </div>

          <select aria-label={tr('Language')} value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="h-10 max-w-[70px] rounded-xl border border-input bg-card px-2 text-xs font-bold outline-none sm:hidden">
            <option value="en">🇬🇧 EN</option><option value="da">🇦🇫 دری</option><option value="ps">🇦🇫 پښتو</option>
          </select>

          <Button variant="outline" size="icon" className="rounded-xl" onClick={toggleTheme} aria-label={tr(theme === 'dark' ? 'Light mode' : 'Dark mode')} title={tr(theme === 'dark' ? 'Light mode' : 'Dark mode')}>
            <FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} />
          </Button>

          {user && (
            <button type="button" onClick={() => navigate('/profile')} className="flex items-center gap-2 rounded-2xl p-1.5 pe-3 transition hover:bg-muted" aria-label={tr('Open profile')}>
              {user.avatar ? <img src={user.avatar} alt={tr('Profile')} className="h-9 w-9 rounded-[13px] border border-border/70 object-cover shadow-sm" /> : <span className="grid h-9 w-9 place-items-center rounded-[13px] bg-gradient-to-br from-sky-500 to-blue-700 text-[11px] font-extrabold text-white shadow-md shadow-sky-500/20">{user.firstName?.[0]}{user.lastName?.[0]}</span>}
              <span className="hidden min-w-0 text-start xl:block">
                <span className="block max-w-32 truncate text-xs font-extrabold">{user.firstName} {user.lastName}</span>
                <span className="block text-[10px] font-medium capitalize text-muted-foreground">{tr(user.role)}</span>
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
