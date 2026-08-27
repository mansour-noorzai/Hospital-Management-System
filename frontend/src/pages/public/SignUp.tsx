
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faEye, faEyeSlash, faHouseMedical, faLock, faUser } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAppDispatch } from '@/store/hooks';
import { setCredentials, type AuthUser } from '@/store/authSlice';
import { AuthShell } from '@/components/Auth/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePreferences } from '@/providers/PreferencesProvider';

const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,100}$/;

const signUpSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(50),
  lastName: z.string().trim().min(1, 'Last name is required').max(50),
  email: z.string().trim().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100)
    .regex(strongPassword, 'Password must include uppercase, lowercase, number, and special character'),
});
type SignUpForm = z.infer<typeof signUpSchema>;

function getRegistrationError(error: unknown) {
  return (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
}

export function SignUp() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { tr, hospital } = usePreferences();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
  });

  const registerMutation = useMutation({
    mutationFn: (data: SignUpForm) =>
      api.post<{ data: { user: AuthUser; accessToken: string } }>('/auth/register', data),
    onSuccess: ({ data }) => {
      dispatch(setCredentials({ user: data.data.user, accessToken: data.data.accessToken }));
      navigate('/dashboard', { replace: true });
    },
  });

  const serverError = registerMutation.isError
    ? getRegistrationError(registerMutation.error) ?? 'Registration failed. Please try again.'
    : null;

  return (
    <AuthShell>
      <Card className="overflow-hidden rounded-[28px] border-border/70 bg-card/90 shadow-2xl shadow-slate-950/5 backdrop-blur-xl dark:shadow-black/20">
        <CardHeader className="space-y-4 px-6 pb-3 pt-7 sm:px-8 sm:pt-8">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <FontAwesomeIcon icon={faHouseMedical} />
            </div>
            <div>
              <p className="font-bold">{hospital?.name ?? 'Hospital'}</p>
              <p className="text-xs text-muted-foreground">{hospital?.systemName ?? tr('Hospital Management System')}</p>
            </div>
          </div>

          <div>
            <CardTitle className="text-3xl font-black tracking-tight">{tr('Create account')}</CardTitle>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{tr('Register as a patient')}</p>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-7 sm:px-8 sm:pb-8">
          <form onSubmit={handleSubmit((data) => registerMutation.mutate(data))} className="space-y-5" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">{tr('First name')}</Label>
                <div className="relative">
                  <FontAwesomeIcon icon={faUser} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" />
                  <Input id="firstName" autoComplete="given-name" className="h-12 rounded-xl ps-10" {...register('firstName')} />
                </div>
                {errors.firstName && <p className="text-xs font-medium text-destructive">{tr(errors.firstName.message ?? '')}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">{tr('Last name')}</Label>
                <div className="relative">
                  <FontAwesomeIcon icon={faUser} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" />
                  <Input id="lastName" autoComplete="family-name" className="h-12 rounded-xl ps-10" {...register('lastName')} />
                </div>
                {errors.lastName && <p className="text-xs font-medium text-destructive">{tr(errors.lastName.message ?? '')}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{tr('Email')}</Label>
              <div className="relative">
                <FontAwesomeIcon icon={faEnvelope} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" />
                <Input id="email" type="email" inputMode="email" autoComplete="email" className="h-12 rounded-xl ps-10" placeholder="name@example.com" {...register('email')} />
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
                  autoComplete="new-password"
                  className="h-12 rounded-xl ps-10 pe-11"
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
              <p className="text-xs leading-5 text-muted-foreground">
                {tr('Password must include uppercase, lowercase, number, and special character')}
              </p>
              {errors.password && <p className="text-xs font-medium text-destructive">{tr(errors.password.message ?? '')}</p>}
            </div>

            {serverError && (
              <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {tr(serverError)}
              </div>
            )}

            <Button type="submit" className="h-12 w-full rounded-xl text-sm font-bold shadow-lg shadow-primary/15" disabled={registerMutation.isPending}>
              {tr(registerMutation.isPending ? 'Creating account...' : 'Create Account')}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {tr('Already have an account?')}{' '}
              <Link to="/sign-in" className="font-semibold text-primary hover:underline">{tr('Sign in')}</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
