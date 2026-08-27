# HMS Frontend

Responsive React and TypeScript interface for the Hospital Management System.

## Interface

- Role-aware navigation for admin, doctor, nurse, receptionist, and patient users
- Responsive dashboard shell with light, dark, LTR, and RTL support
- Font Awesome icon system
- Plus Jakarta Sans and Vazirmatn typography
- Live hospital branding, colors, logo, favicon, language, and theme preferences
- TanStack Query cache synchronization for mutations and Socket.io events
- Route-level code splitting for faster initial loading

## Commands

```bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm run test:run
npm run build
```

The Vite development server proxies `/api` and `/socket.io` to the existing backend on port `4451`.
