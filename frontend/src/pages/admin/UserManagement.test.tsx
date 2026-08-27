// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { authReducer, setCredentials } from '@/store/authSlice';
import { AdminUserManagement } from './UserManagement';

const apiGet = vi.fn();
vi.mock('@/lib/api', () => ({ default: { get: (...args: unknown[]) => apiGet(...args), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('@/lib/socket', () => ({ getSocket: () => ({ on: vi.fn(), off: vi.fn() }) }));
vi.mock('@/providers/PreferencesProvider', () => ({ usePreferences: () => ({ tr: (value: string) => value }) }));

describe('Admin User Management route', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith('/users?')) return Promise.resolve({ data: { success: true, data: [{ _id: 'u1', firstName: 'Hospital', lastName: 'Admin', email: 'admin@example.com', role: 'admin', status: 'active', isActive: true, createdAt: '2026-01-01T00:00:00.000Z', profile: null }], meta: { page: 1, total: 1, totalPages: 1 } } });
      if (url === '/departments') return Promise.resolve({ data: { success: true, data: [] } });
      if (url === '/users/permissions/catalog') return Promise.resolve({ data: { success: true, data: ['patients.read'] } });
      return Promise.reject(new Error(`Unexpected request ${url}`));
    });
  });

  it('renders the page, loads users, and opens the create dialog', async () => {
    const store = configureStore({ reducer: { auth: authReducer } });
    store.dispatch(setCredentials({ user: { _id: 'u1', firstName: 'Hospital', lastName: 'Admin', email: 'admin@example.com', role: 'admin', hospitalId: 'h1', isPlatformAdmin: true, forcePasswordChange: false }, accessToken: 'token' }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<Provider store={store}><QueryClientProvider client={client}><MemoryRouter initialEntries={['/admin/users']}><Routes><Route path="/admin/users" element={<AdminUserManagement />} /></Routes></MemoryRouter></QueryClientProvider></Provider>);
    expect(screen.getByRole('heading', { name: 'User Management' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('admin@example.com')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.getByRole('heading', { name: 'Create User' })).toBeInTheDocument();
  });
});
