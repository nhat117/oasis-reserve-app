import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Leaf, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { loginSchema, forgotPasswordSchema, validateField } from '@/lib/validation';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const { signIn, logActivity } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleBlur = (schema: typeof loginSchema | typeof forgotPasswordSchema, field: string, value: string, schemaField: string = field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    setFieldErrors(prev => ({ ...prev, [field]: validateField(schema as any, schemaField, value) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const errors: Record<string, string | null> = {};
      const allTouched: Record<string, boolean> = {};
      result.error.errors.forEach(err => {
        const field = err.path[0] as string;
        errors[field] = err.message;
        allTouched[field] = true;
      });
      setFieldErrors(prev => ({ ...prev, ...errors }));
      setTouched(prev => ({ ...prev, ...allTouched }));
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast({ title: 'Login failed', description: 'Incorrect email or password.', variant: 'destructive' });
    } else {
      logActivity('login', `Logged in as ${email}`);
      navigate('/admin');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = forgotPasswordSchema.safeParse({ email: forgotEmail });
    if (!result.success) {
      setTouched(prev => ({ ...prev, forgotEmail: true }));
      setFieldErrors(prev => ({ ...prev, forgotEmail: result.error.errors[0]?.message || 'Invalid email' }));
      return;
    }
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    });
    setForgotLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Email sent', description: 'Check your inbox for a password reset link.' });
      setForgotMode(false);
    }
  };

  if (forgotMode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <Leaf className="h-8 w-8 text-primary mx-auto mb-2" />
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>Enter your admin email to receive a reset link</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={e => { setForgotEmail(e.target.value); if (touched.forgotEmail) setFieldErrors(prev => ({ ...prev, forgotEmail: validateField(forgotPasswordSchema, 'email', e.target.value) })); }}
                  onBlur={() => handleBlur(forgotPasswordSchema, 'forgotEmail', forgotEmail, 'email')}
                  required
                  className={`mt-1 ${touched.forgotEmail && fieldErrors.forgotEmail ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                />
                {touched.forgotEmail && fieldErrors.forgotEmail && (
                  <p className="text-xs text-destructive mt-1">{fieldErrors.forgotEmail}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={forgotLoading}>
                {forgotLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>
              <button type="button" onClick={() => setForgotMode(false)} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
                Back to login
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Leaf className="h-8 w-8 text-primary mx-auto mb-2" />
          <CardTitle>Admin Login</CardTitle>
          <CardDescription>Enter your admin credentials</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); if (touched.email) setFieldErrors(prev => ({ ...prev, email: validateField(loginSchema, 'email', e.target.value) })); }}
                onBlur={() => handleBlur(loginSchema, 'email', email)}
                required
                className={`mt-1 ${touched.email && fieldErrors.email ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              />
              {touched.email && fieldErrors.email && (
                <p className="text-xs text-destructive mt-1">{fieldErrors.email}</p>
              )}
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (touched.password) setFieldErrors(prev => ({ ...prev, password: validateField(loginSchema, 'password', e.target.value) })); }}
                  onBlur={() => handleBlur(loginSchema, 'password', password)}
                  required
                  className={`pr-10 ${touched.password && fieldErrors.password ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {touched.password && fieldErrors.password && (
                <p className="text-xs text-destructive mt-1">{fieldErrors.password}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
            <button type="button" onClick={() => { setForgotMode(true); setForgotEmail(email); }} className="w-full text-sm text-muted-foreground hover:text-primary transition-colors">
              Forgot password?
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
