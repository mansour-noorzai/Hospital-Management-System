
import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppLayout() {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <div className="app-shell flex h-dvh overflow-hidden bg-background text-foreground md:gap-4 md:p-4">
      <Sidebar
        mobileOpen={mobileNavigationOpen}
        onMobileClose={() => setMobileNavigationOpen(false)}
      />

      <div className="app-content-shell flex min-w-0 flex-1 flex-col overflow-hidden md:gap-4">
        <Topbar onOpenNavigation={() => setMobileNavigationOpen(true)} />
        <main className="app-main flex-1 overflow-y-auto md:rounded-[24px] md:border md:border-border/60">
          <div className="mx-auto w-full max-w-[1680px] p-4 sm:p-6 xl:p-7">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
