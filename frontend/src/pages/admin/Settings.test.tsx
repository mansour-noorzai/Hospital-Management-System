// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminSettings } from './Settings';

const apiGet = vi.fn();
const apiPatch = vi.fn();
const toastSuccess = vi.fn();

const hospital = {
  _id: 'h1', name: 'City Hospital', systemName: 'City HMS', shortName: 'CHMS', address: 'Herat',
  defaultTaxRate: 2, workingHours: { start: '08:00', end: '17:00' }, timezone: 'Asia/Kabul',
  primaryColor: '#0ea5e9', accentColor: '#14b8a6', currency: 'AFN', dateFormat: 'yyyy-MM-dd',
  defaultLanguage: 'en', defaultTheme: 'light',
};

vi.mock('@/lib/api', () => ({ default: { get: (...args: unknown[]) => apiGet(...args), patch: (...args: unknown[]) => apiPatch(...args) } }));
vi.mock('react-hot-toast', () => ({ default: { success: (...args: unknown[]) => toastSuccess(...args), error: vi.fn() } }));

function renderSettings() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><AdminSettings /></QueryClientProvider>);
}

beforeEach(() => {
  apiGet.mockReset();
  apiPatch.mockReset();
  toastSuccess.mockReset();
  apiGet.mockResolvedValue({ data: { success: true, data: hospital } });
  apiPatch.mockImplementation((_url: string, payload: Record<string, unknown>) => Promise.resolve({ data: { success: true, data: { ...hospital, ...payload } } }));
});

afterEach(() => cleanup());

describe('Admin Settings', () => {
  it('saves a changed system name without reloading the page', async () => {
    renderSettings();
    const input = await screen.findByLabelText('System display name');
    fireEvent.change(input, { target: { value: 'Modern Hospital Workspace' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save changes' })[0]);
    await waitFor(() => expect(apiPatch).toHaveBeenCalled());
    expect(apiPatch.mock.calls[0][0]).toBe('/hospital');
    expect(apiPatch.mock.calls[0][1]).toMatchObject({ systemName: 'Modern Hospital Workspace' });
    expect(toastSuccess).toHaveBeenCalledWith('Settings saved and applied');
  });
});
