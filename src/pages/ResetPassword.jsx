import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2 } from 'lucide-react';
import stamaLogo from '@/assets/stama-logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User } from '@/api/entities';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await User.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      setError(err.message || 'Não foi possível redefinir a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border-0">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-xl overflow-hidden mx-auto mb-4 shadow-lg">
              <img src={stamaLogo} alt="STAMA" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Redefinir senha</h1>
            <p className="text-slate-600 dark:text-slate-300">Escolha uma nova senha para sua conta.</p>
          </div>

          {!token ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                Link inválido. Solicite a redefinição de senha novamente.
              </p>
              <Link to="/forgot-password" className="inline-block text-blue-600 dark:text-blue-400 font-medium hover:underline">
                Esqueci minha senha
              </Link>
            </div>
          ) : done ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Senha redefinida! Levando você para o login...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm_password">Confirmar nova senha</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
              )}

              <Button type="submit" disabled={loading} className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700 gap-2">
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                Redefinir senha
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
