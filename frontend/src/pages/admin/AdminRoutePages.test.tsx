// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { authReducer, setCredentials } from '@/store/authSlice';
import { AdminDepartments } from './Departments';
import { AdminRolesPermissions } from './RolesPermissions';
import { AdminAuditLogs } from './AuditLogs';
import { MyProfile } from '@/pages/shared/Profile';
import { PreferencesProvider } from '@/providers/PreferencesProvider';

const apiGet = vi.fn((url: string) => {
  if (url === '/departments') return Promise.resolve({ data: { success: true, data: [] } });
  if (url.startsWith('/doctors')) return Promise.resolve({ data: { success: true, data: [], meta: { total: 0 } } });
  if (url === '/users/permissions/matrix') return Promise.resolve({ data: { success: true, data: {} } });
  if (url.startsWith('/audit-logs')) return Promise.resolve({ data: { success: true, data: [], meta: { page: 1, total: 0, totalPages: 0 } } });
  if (url === '/auth/me') return Promise.resolve({ data: { success: true, data: { user: { _id: 'u1', firstName: 'Hospital', lastName: 'Admin', email: 'admin@example.com', role: 'admin', hospitalId: 'h1', isPlatformAdmin: true, forcePasswordChange: false } } } });
  if (url === '/hospital/branding') return Promise.resolve({ data: { success: true, data: { _id: 'h1', name: 'Test Hospital', systemName: 'HMS', shortName: 'HMS', primaryColor: '#0f766e', accentColor: '#0891b2', defaultLanguage: 'en', defaultTheme: 'light', currency: 'AFN', timezone: 'Asia/Kabul', dateFormat: 'yyyy-MM-dd' } } });
  return Promise.reject(new Error(`Unexpected request ${url}`));
});

vi.mock('@/lib/api', () => ({ default: { get: (...args: unknown[]) => apiGet(...args as [string]), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('@/lib/socket', () => ({ disconnectSocket: vi.fn(), getSocket: () => ({ on: vi.fn(), off: vi.fn() }) }));

function renderPage(page: React.ReactNode) {
  localStorage.setItem('hms-theme', 'light');
  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(setCredentials({ user: { _id: 'u1', firstName: 'Hospital', lastName: 'Admin', email: 'admin@example.com', role: 'admin', hospitalId: 'h1', isPlatformAdmin: true, forcePasswordChange: false }, accessToken: 'token' }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<Provider store={store}><QueryClientProvider client={client}><PreferencesProvider><MemoryRouter>{page}</MemoryRouter></PreferencesProvider></QueryClientProvider></Provider>);
}

afterEach(() => cleanup());

describe('new application route pages', () => {
  it.each([
    ['Departments', <AdminDepartments key="departments" />],
    ['Roles & Permissions', <AdminRolesPermissions key="roles" />],
    ['Audit Logs', <AdminAuditLogs key="audit" />],
    ['My Profile', <MyProfile key="profile" />],
  ])('renders %s with live API state', async (heading, page) => {
    renderPage(page);
    await waitFor(() => expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument());
  });
});
