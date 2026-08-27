// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminAnalytics } from './Analytics';

const apiGet = vi.fn();

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

vi.mock('@/lib/api', () => ({ default: { get: (...args: unknown[]) => apiGet(...args) } }));
vi.mock('@/providers/PreferencesProvider', () => ({
  usePreferences: () => ({ language: 'en', hospital: { currency: 'AFN' } }),
}));

function renderAnalytics() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><AdminAnalytics /></QueryClientProvider>);
}

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockImplementation((url: string) => {
    if (url.startsWith('/analytics/appointments')) return Promise.resolve({ data: { success: true, data: { volumeByPeriod: [{ _id: '2026-08', count: 8 }], byStatus: [{ _id: 'completed', count: 6 }, { _id: 'scheduled', count: 2 }], byDoctor: [{ _id: 'd1', doctorName: 'Dr. Safi', count: 5 }] } } });
    if (url === '/analytics/revenue') return Promise.resolve({ data: { success: true, data: { byMonth: [{ _id: '2026-08', revenue: 12500 }], outstanding: 2500, paymentMethods: [{ _id: 'cash', count: 3, amount: 12500 }] } } });
    if (url === '/analytics/lab') return Promise.resolve({ data: { success: true, data: { byPriority: [{ _id: 'routine', count: 4 }], byStatus: [{ _id: 'completed', count: 4 }], recentVolume: [{ _id: '2026-08', count: 4 }] } } });
    if (url === '/analytics/prescriptions') return Promise.resolve({ data: { success: true, data: { byStatus: [{ _id: 'dispensed', count: 3 }], fillRate: 0.75, topDrugs: [{ _id: 'Amoxicillin', count: 3 }] } } });
    return Promise.reject(new Error(`Unexpected request ${url}`));
  });
});

afterEach(() => cleanup());

describe('Admin Analytics', () => {
  it('renders all analytics sections and accepts backend payment amount fields', async () => {
    renderAnalytics();
    expect(screen.getByRole('heading', { name: 'Analytics' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Dr. Safi')).toBeInTheDocument());
    expect(screen.getByText(/AFN\s*12,500/)).toBeInTheDocument();
    expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
    expect(screen.getByText('75.0%')).toBeInTheDocument();
  });
});
