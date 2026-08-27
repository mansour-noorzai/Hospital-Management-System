
import { useEffect } from 'react';
import axios from 'axios';
import { useAppDispatch } from '@/store/hooks';
import { setCredentials, setLoading, type AuthUser } from '@/store/authSlice';
import { connectSocket } from '@/lib/socket';

interface RestoredSession {
  user: AuthUser;
  accessToken: string;
}

let restoreSessionPromise: Promise<RestoredSession | null> | null = null;

function restoreSession(): Promise<RestoredSession | null> {
  if (!restoreSessionPromise) {
    restoreSessionPromise = axios
      .post<{ data: { accessToken: string } }>('/api/v1/auth/refresh', {}, { withCredentials: true })
      .then(async ({ data }) => {
        const accessToken = data?.data?.accessToken;
        if (!accessToken) return null;

        const meResponse = await axios.get<{ data: { user: AuthUser } }>('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
          withCredentials: true,
        });

        return { user: meResponse.data.data.user, accessToken };
      })
      .catch(() => null);
  }

  return restoreSessionPromise;
}

export function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let active = true;

    restoreSession()
      .then((session) => {
        if (!active || !session) return;
        dispatch(setCredentials(session));
        connectSocket();
      })
      .finally(() => {
        if (active) dispatch(setLoading(false));
      });

    return () => {
      active = false;
    };
  }, [dispatch]);

  return <>{children}</>;
}
