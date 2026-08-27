
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { AuthShell } from '@/components/Auth/AuthShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePreferences } from '@/providers/PreferencesProvider';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const { tr } = usePreferences();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: () => api.post('/auth/forgot-password', { email: email.trim() }),
    onSuccess: () => setSubmitted(true),
  });

  return (
    <AuthShell>
      <Card className="rounded-[28px] border-border/70 bg-card/90 shadow-2xl shadow-slate-950/5 backdrop-blur-xl dark:shadow-black/20">
        <CardHeader className="px-6 pb-3 pt-8 sm:px-8">
          <CardTitle className="text-3xl font-black tracking-tight">{tr('Reset password')}</CardTitle>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {tr('Enter your email and we will send a password reset link.')}
          </p>
        </CardHeader>
        <CardContent className="px-6 pb-8 sm:px-8">
          {submitted ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-700 dark:text-emerald-300">
                {tr('If that email is registered, a reset link has been sent')}
              </div>
              <Button className="h-12 w-full rounded-xl" onClick={() => navigate('/sign-in')}>
                {tr('Back to sign in')}
              </Button>
            </div>
          ) : (
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (email.trim()) mutation.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="reset-email">{tr('Email')}</Label>
                <div className="relative">
                  <FontAwesomeIcon icon={faEnvelope} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" />
                  <Input
                    id="reset-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-12 rounded-xl ps-10"
                    placeholder="name@example.com"
                  />
                </div>
              </div>
              {mutation.isError && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {tr('Unable to process the request. Please try again.')}
                </div>
              )}
              <Button type="submit" className="h-12 w-full rounded-xl" disabled={mutation.isPending || !email.trim()}>
                {tr(mutation.isPending ? 'Sending...' : 'Send reset link')}
              </Button>
              <p className="text-center text-sm">
                <Link to="/sign-in" className="font-semibold text-primary hover:underline">{tr('Back to sign in')}</Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}
