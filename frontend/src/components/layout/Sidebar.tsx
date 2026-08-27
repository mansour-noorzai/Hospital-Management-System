import { NavLink } from 'react-router-dom';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faAnglesLeft,
  faAnglesRight,
  faBoxesStacked,
  faBuilding,
  faCalendarCheck,
  faCapsules,
  faChartLine,
  faCircleUser,
  faClockRotateLeft,
  faFileInvoiceDollar,
  faFileShield,
  faFlaskVial,
  faGaugeHigh,
  faHospitalUser,
  faHouseMedical,
  faRightFromBracket,
  faSliders,
  faUserDoctor,
  faUserGear,
  faUserShield,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import type { AuthUser } from '@/store/authSlice';
import { useAuth } from '@/hooks/useAuth';
import { usePreferences } from '@/providers/PreferencesProvider';

type NavigationSection = 'Workspace' | 'Care operations' | 'Administration' | 'Governance';

interface NavItem {
  label: string;
  href: string;
  icon: IconDefinition;
  roles: Array<AuthUser['role']>;
  section: NavigationSection;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: faGaugeHigh, roles: ['admin', 'doctor', 'nurse', 'receptionist', 'patient'], section: 'Workspace' },
  { label: 'My Profile', href: '/profile', icon: faCircleUser, roles: ['admin', 'doctor', 'nurse', 'receptionist', 'patient'], section: 'Workspace' },
  { label: 'Patients', href: '/patients', icon: faHospitalUser, roles: ['admin', 'doctor', 'nurse', 'receptionist'], section: 'Care operations' },
  { label: 'Appointments', href: '/admin/appointments', icon: faCalendarCheck, roles: ['admin', 'receptionist'], section: 'Care operations' },
  { label: 'Appointments', href: '/patient/appointments', icon: faCalendarCheck, roles: ['patient'], section: 'Care operations' },
  { label: 'Schedule', href: '/doctor/schedule', icon: faCalendarCheck, roles: ['doctor'], section: 'Care operations' },
  { label: 'Lab Orders', href: '/doctor/lab', icon: faFlaskVial, roles: ['doctor'], section: 'Care operations' },
  { label: 'Lab Results', href: '/patient/lab', icon: faFlaskVial, roles: ['patient'], section: 'Care operations' },
  { label: 'Lab Management', href: '/admin/lab', icon: faFlaskVial, roles: ['admin', 'nurse'], section: 'Care operations' },
  { label: 'Prescriptions', href: '/doctor/prescriptions', icon: faCapsules, roles: ['doctor'], section: 'Care operations' },
  { label: 'Dispensing Queue', href: '/nurse/dispensing', icon: faCapsules, roles: ['nurse'], section: 'Care operations' },
  { label: 'My Prescriptions', href: '/patient/prescriptions', icon: faCapsules, roles: ['patient'], section: 'Care operations' },
  { label: 'Documents', href: '/doctor/documents', icon: faFileShield, roles: ['doctor'], section: 'Care operations' },
  { label: 'My Documents', href: '/patient/documents', icon: faFileShield, roles: ['patient'], section: 'Care operations' },
  { label: 'Documents', href: '/admin/documents', icon: faFileShield, roles: ['admin'], section: 'Care operations' },
  { label: 'Billing', href: '/admin/billing', icon: faFileInvoiceDollar, roles: ['admin', 'receptionist'], section: 'Administration' },
  { label: 'My Bills', href: '/patient/billing', icon: faFileInvoiceDollar, roles: ['patient'], section: 'Administration' },
  { label: 'Pharmacy', href: '/admin/pharmacy', icon: faCapsules, roles: ['admin'], section: 'Administration' },
  { label: 'Inventory', href: '/admin/inventory', icon: faBoxesStacked, roles: ['admin'], section: 'Administration' },
  { label: 'Inventory', href: '/nurse/inventory', icon: faBoxesStacked, roles: ['nurse'], section: 'Administration' },
  { label: 'User Management', href: '/admin/users', icon: faUserGear, roles: ['admin'], section: 'Administration' },
  { label: 'Staff', href: '/admin/staff', icon: faUserDoctor, roles: ['admin'], section: 'Administration' },
  { label: 'Departments', href: '/admin/departments', icon: faBuilding, roles: ['admin'], section: 'Administration' },
  { label: 'Analytics', href: '/admin/analytics', icon: faChartLine, roles: ['admin'], section: 'Governance' },
  { label: 'Roles & Permissions', href: '/admin/roles', icon: faUserShield, roles: ['admin'], section: 'Governance' },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: faClockRotateLeft, roles: ['admin'], section: 'Governance' },
  { label: 'Settings', href: '/admin/settings', icon: faSliders, roles: ['admin'], section: 'Governance' },
];

const SECTIONS: NavigationSection[] = ['Workspace', 'Care operations', 'Administration', 'Governance'];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const { user } = usePermissions();
  const { logoutMutation } = useAuth();
  const { dir, tr, hospital } = usePreferences();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('hms-sidebar-collapsed') === 'true');

  const visibleItems = NAV_ITEMS.filter((item) => user && item.roles.includes(user.role));

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem('hms-sidebar-collapsed', String(next));
      return next;
    });
  };

  const aside = (
    <aside
      className={cn(
        'flex h-full flex-col overflow-hidden border border-border/70 bg-card shadow-[var(--shell-shadow)] transition-[width] duration-300 md:rounded-[24px]',
        collapsed ? 'w-[84px]' : 'w-[280px]',
      )}
    >
      <div className="flex h-[78px] items-center justify-between border-b border-border/60 px-4">
        <div className={cn('flex min-w-0 items-center gap-3', collapsed && 'flex-1 justify-center')}>
          {hospital?.logoUrl ? (
            <img src={hospital.logoUrl} alt={hospital.name} className="h-11 w-11 shrink-0 rounded-2xl border border-border/60 bg-white object-contain p-1.5 shadow-sm" />
          ) : (
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-lg shadow-sky-500/20">
              <FontAwesomeIcon icon={faHouseMedical} className="text-lg" />
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[15px] font-extrabold tracking-tight">{hospital?.shortName ?? 'HMS'}</p>
              <p className="truncate text-[10px] font-medium text-muted-foreground">{hospital?.systemName ?? tr('Hospital Management System')}</p>
            </div>
          )}
        </div>

        <button type="button" onClick={toggleCollapsed} className="hidden h-9 w-9 place-items-center rounded-xl border border-transparent text-muted-foreground transition hover:border-border hover:bg-muted hover:text-foreground md:grid" aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
          <FontAwesomeIcon icon={collapsed ? (dir === 'rtl' ? faAnglesLeft : faAnglesRight) : (dir === 'rtl' ? faAnglesRight : faAnglesLeft)} className="text-xs" />
        </button>

        <button type="button" onClick={onMobileClose} className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted md:hidden" aria-label="Close navigation">
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {SECTIONS.map((section) => {
          const sectionItems = visibleItems.filter((item) => item.section === section);
          if (sectionItems.length === 0) return null;
          return (
            <div key={section} className="mb-5 last:mb-0">
              {!collapsed && <p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground/75">{tr(section)}</p>}
              <div className="space-y-1">
                {sectionItems.map((item) => (
                  <NavLink key={`${item.href}-${item.label}`} to={item.href} onClick={onMobileClose} className={({ isActive }) => cn('group relative flex min-h-11 items-center gap-3 rounded-[14px] px-3 text-[13px] font-semibold transition-all duration-200', isActive ? 'bg-sky-500/12 text-sky-700 shadow-sm ring-1 ring-sky-500/10 dark:text-sky-300' : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground', collapsed && 'justify-center px-2')} title={collapsed ? tr(item.label) : undefined}>
                    {({ isActive }) => (
                      <>
                        <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-[11px] transition', isActive ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20' : 'bg-muted/75 text-muted-foreground group-hover:bg-card group-hover:text-primary')}>
                          <FontAwesomeIcon icon={item.icon} className="text-[13px]" />
                        </span>
                        {!collapsed && <span className="truncate">{tr(item.label)}</span>}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border/60 p-3">
        {user && (
          <div className={cn('mb-2 flex items-center gap-3 rounded-2xl bg-sky-500/[0.07] p-3 ring-1 ring-sky-500/10', collapsed && 'justify-center p-2')}>
            {user.avatar ? (
              <img src={user.avatar} alt={tr('Profile')} className="h-10 w-10 shrink-0 rounded-[14px] border border-border/70 object-cover shadow-sm" />
            ) : (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br from-sky-500 to-blue-700 text-xs font-extrabold text-white shadow-md shadow-sky-500/20">
                {user.firstName?.[0]?.toUpperCase()}{user.lastName?.[0]?.toUpperCase()}
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold">{user.firstName} {user.lastName}</p>
                <p className="truncate text-[10px] font-medium capitalize text-muted-foreground">{tr(user.role)}</p>
              </div>
            )}
          </div>
        )}

        <button type="button" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending} className={cn('flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-[13px] font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-50', collapsed && 'justify-center px-2')} title={collapsed ? tr('Sign out') : undefined}>
          <span className="grid h-8 w-8 place-items-center rounded-[11px] bg-destructive/10"><FontAwesomeIcon icon={faRightFromBracket} className="text-[13px]" /></span>
          {!collapsed && <span>{tr('Sign out')}</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden h-full md:block">{aside}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label="Close navigation overlay" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={onMobileClose} />
          <div className={cn('absolute inset-y-0', dir === 'rtl' ? 'right-0' : 'left-0')}>{aside}</div>
        </div>
      )}
    </>
  );
}
