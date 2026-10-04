import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Button, Field, Input } from '../components/ui';
import meuLogo from '../assets/meu-logo.png';

export default function Login() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    return <Navigate to={location.state?.from?.pathname || '/operations'} replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate(location.state?.from?.pathname || '/operations', { replace: true });
    } catch (err) {
      // Deliberately generic: the raw Firebase code reveals whether an account exists.
      console.error('[auth]', err.code);
      setError(t('login_failed'));
      setBusy(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-box__brand">
          <img src={meuLogo} alt="MEU Logo" style={{ height: '70px', marginBottom: '10px', objectFit: 'contain' }} />
          <div className="login-box__sub">{t('admin_panel')}</div>
        </div>

        {error && (
          <div className="login-error" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />{error}
          </div>
        )}

        <form onSubmit={handleLogin} noValidate>
          <Field label={t('email')} required htmlFor="login-email">
            <Input id="login-email" type="email" autoComplete="username" required
                   value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!error} />
          </Field>
          <Field label={t('password')} required htmlFor="login-password">
            <Input id="login-password" type="password" autoComplete="current-password" required
                   value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!error} />
          </Field>
          <Button type="submit" variant="primary" size="lg" block loading={busy}>
            {busy ? t('logging_in') : t('log_in')}
          </Button>
        </form>
      </div>
    </div>
  );
}
