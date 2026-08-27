
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faLock } from '@fortawesome/free-solid-svg-icons';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { AuthShell } from '@/components/Auth/AuthShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePreferences } from '@/providers/PreferencesProvider';

const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,100}$/;

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [completed, setCompleted] = useState(false);
  const { tr } = usePreferences();

  const isPasswordValid = useMemo(() => strongPassword.test(password), [password]);

  const mutation = useMutation({
    mutationFn: () => api.post('/auth/reset-password', { token, password }),
    onSuccess: () => setCompleted(true),
  });

  return (
    <AuthShell>
      <Card className="rounded-[28px] border-border/70 bg-card/90 shadow-2xl shadow-slate-950/5 backdrop-blur-xl dark:shadow-black/20">
        <CardHeader className="px-6 pb-3 pt-8 sm:px-8">
          <CardTitle className="text-3xl font-black tracking-tight">{tr('Set a new password')}</CardTitle>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {tr('Use a strong password you have not used before.')}
          </p>
        </CardHeader>
        <CardContent className="px-6 pb-8 sm:px-8">
          {!token ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {tr('Password reset token is missing.')}
              </div>
              <Link to="/forgot-password" className="block text-center font-semibold text-primary hover:underline">
                {tr('Request a new reset link')}
              </Link>
            </div>
          ) : completed ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-700 dark:text-emerald-300">
                {tr('Password reset successfully')}
              </div>
              <Link to="/sign-in" className="block text-center font-semibold text-primary hover:underline">
                {tr('Sign in')}
              </Link>
            </div>
          ) : (
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (isPasswordValid) mutation.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="new-password">{tr('New password')}</Label>
                <div className="relative">
                  <FontAwesomeIcon icon={faLock} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 rounded-xl ps-10 pe-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute end-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="text-sm" />
                  </button>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  {tr('Password must include uppercase, lowercase, number, and special character')}
                </p>
              </div>

              {mutation.isError && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {tr('Password reset token is invalid or expired')}
                </div>
              )}

              <Button type="submit" className="h-12 w-full rounded-xl" disabled={mutation.isPending || !isPasswordValid}>
                {tr(mutation.isPending ? 'Saving...' : 'Reset password')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}
