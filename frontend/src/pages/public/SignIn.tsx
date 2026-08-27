
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faEye, faEyeSlash, faHouseMedical, faLock } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AuthShell } from '@/components/Auth/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePreferences } from '@/providers/PreferencesProvider';

const signInSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
type SignInForm = z.infer<typeof signInSchema>;

function getAuthError(error: unknown) {
  return (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
}

export function SignIn() {
  const { loginMutation } = useAuth();
  const { tr, hospital } = usePreferences();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard';

  const { register, handleSubmit, formState: { errors } } = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (data: SignInForm) => {
    loginMutation.mutate(data, {
      onSuccess: () => navigate(from, { replace: true }),
    });
  };

  const serverError = loginMutation.isError
    ? getAuthError(loginMutation.error) ?? 'Invalid email or password'
    : null;

  return (
    <AuthShell>
      <Card className="overflow-hidden rounded-[28px] border-border/70 bg-card/90 shadow-2xl shadow-slate-950/5 backdrop-blur-xl dark:shadow-black/20">
        <CardHeader className="space-y-4 px-6 pb-3 pt-7 sm:px-8 sm:pt-8">
          <div className="flex items-center gap-3 lg:hidden">
            {hospital?.logoUrl ? <img src={hospital.logoUrl} alt={hospital.name} className="h-10 w-10 rounded-xl object-contain" /> : <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 text-white"><FontAwesomeIcon icon={faHouseMedical} /></div>}
            <div>
              <p className="font-bold">{hospital?.name ?? 'Hospital'}</p>
              <p className="text-xs text-muted-foreground">{hospital?.systemName ?? tr('Hospital Management System')}</p>
            </div>
          </div>

          <div>
            <CardTitle className="text-3xl font-black tracking-tight">{tr('Welcome back')}</CardTitle>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{tr('Sign in to HMS')}</p>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-7 sm:px-8 sm:pb-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">{tr('Email')}</Label>
              <div className="relative">
                <FontAwesomeIcon icon={faEnvelope} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="name@hospital.com"
                  className="h-12 rounded-xl ps-10"
                  aria-invalid={Boolean(errors.email)}
                  {...register('email')}
                />
              </div>
              {errors.email && <p className="text-xs font-medium text-destructive">{tr(errors.email.message ?? '')}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{tr('Password')}</Label>
              <div className="relative">
                <FontAwesomeIcon icon={faLock} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="h-12 rounded-xl ps-10 pe-11"
                  aria-invalid={Boolean(errors.password)}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute end-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="text-sm" />
                </button>
              </div>
              {errors.password && <p className="text-xs font-medium text-destructive">{tr(errors.password.message ?? '')}</p>}
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
                {tr('Forgot password?')}
              </Link>
            </div>

            {serverError && (
              <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {tr(serverError)}
              </div>
            )}

            <Button type="submit" className="h-12 w-full rounded-xl text-sm font-bold shadow-lg shadow-primary/15" disabled={loginMutation.isPending}>
              {tr(loginMutation.isPending ? 'Signing in...' : 'Sign In')}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {tr("Don't have an account?")}{' '}
              <Link to="/sign-up" className="font-semibold text-primary hover:underline">
                {tr('Create account')}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
