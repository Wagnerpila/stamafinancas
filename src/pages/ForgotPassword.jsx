import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MailCheck } from 'lucide-react';
import stamaLogo from '@/assets/stama-logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User } from '@/api/entities';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await User.forgotPassword(email);
      // Resposta é sempre a mesma exista ou não a conta (o backend nunca revela isso) — por
      // isso mostramos a mesma tela de sucesso independente do email digitado.
      setSent(true);
    } catch (err) {
      setError(err.message || 'Não foi possível enviar o email de redefinição.');
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
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Esqueci minha senha</h1>
            <p className="text-slate-600 dark:text-slate-300">
              Informe seu email e enviaremos um link para redefinir sua senha.
            </p>
          </div>

          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                <MailCheck className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Se houver uma conta com o email <strong>{email}</strong>, enviamos um link de
                redefinição. Confira sua caixa de entrada (e o spam) — o link vale por 1 hora.
              </p>
              <Link to="/login" className="inline-block text-blue-600 dark:text-blue-400 font-medium hover:underline">
                Voltar para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
              )}

              <Button type="submit" disabled={loading} className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700 gap-2">
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                Enviar link de redefinição
              </Button>

              <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                <Link to="/login" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
                  Voltar para o login
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
