import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '@/lib/socket';
import { disconnectSocket } from '@/lib/socket';
import { useAppSelector } from '@/store/hooks';
import { useAppDispatch } from '@/store/hooks';
import { clearCredentials } from '@/store/authSlice';
import { navigateInApp } from '@/lib/navigation';

const EVENT_KEYS: Record<string, string[][]> = {
  'user.created': [['users'], ['staff']], 'user.updated': [['users'], ['staff']],
  'user.deactivated': [['users']], 'user.reactivated': [['users']], 'user.roleChanged': [['users'], ['staff']],
  'appointment.created': [['appointments'], ['admin-dash'], ['doctor-dashboard'], ['patient-dashboard'], ['receptionist-dashboard']], 'appointment.updated': [['appointments'], ['admin-dash'], ['doctor-dashboard'], ['patient-dashboard'], ['receptionist-dashboard']], 'appointment:statusChanged': [['appointments']],
  'lab.order.created': [['lab-orders'], ['lab-order']], 'lab.order.updated': [['lab-orders'], ['lab-order']], 'lab.result.updated': [['lab-orders'], ['lab-order'], ['lab-result']],
  'prescription.created': [['prescriptions']], 'prescription.dispensed': [['prescriptions'], ['inventory-items'], ['inventory-items-nurse']],
  'inventory.updated': [['inventory-items'], ['inventory-items-nurse'], ['inventory-low']], 'inventory:low-stock': [['inventory-items'], ['inventory-low']],
  'invoice.updated': [['invoices'], ['billing']], 'payment.received': [['invoices'], ['billing']],
  'hospital.settings.updated': [['hospital']], 'permission.updated': [['permissions']],
};

export function RealtimeQuerySync() {
  const authenticated = useAppSelector(state => state.auth.isAuthenticated);
  const dispatch = useAppDispatch();
  const client = useQueryClient();
  useEffect(() => {
    if (!authenticated) return;
    const socket = getSocket();
    const handler = (event: string) => {
      if (['user.deactivated', 'user.roleChanged', 'permission.updated', 'user.sessionsRevoked'].includes(event)) {
        disconnectSocket();
        client.clear();
        dispatch(clearCredentials());
        navigateInApp('/sign-in', { replace: true });
        return;
      }
      for (const key of EVENT_KEYS[event] ?? []) void client.invalidateQueries({ queryKey: key });
    };
    socket.onAny(handler);
    return () => { socket.offAny(handler); };
  }, [authenticated, client, dispatch]);
  return null;
}
