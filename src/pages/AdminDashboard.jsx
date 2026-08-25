import React, { useState, useEffect } from 'react';
import { User } from '@/entities/User';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { ShieldCheck, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import WhatsAppBotPanel from '@/components/admin/WhatsAppBotPanel';
import WipeMyDataButton from '@/components/admin/WipeMyDataButton';

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [sharedDataMap, setSharedDataMap] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const user = await User.me();
        if (user.role !== 'admin') {
          navigate(createPageUrl('Dashboard'));
        } else {
          setCurrentUser(user);
          loadUsers();
        }
      } catch (error) {
        navigate(createPageUrl('Dashboard'));
      }
    };
    checkAdmin();
  }, [navigate]);

  const loadUsers = async () => {
    try {
      const [allUsers, allShared] = await Promise.all([
        User.list(),
        base44.entities.SharedFinancialData.list('-created_date', 200)
      ]);
      // Sort by created_date ascending to get sequential numbers
      const sorted = [...allShared].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      const map = {};
      sorted.forEach((s, idx) => { map[s.user_id] = { number: idx + 1, anonymous_id: s.anonymous_id }; });
      setSharedDataMap(map);
      setUsers(allUsers);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = async (userId, field, value) => {
    try {
      await User.update(userId, { [field]: value });
      setUsers(prevUsers => 
        prevUsers.map(u => u.id === userId ? { ...u, [field]: value } : u)
      );
    } catch (error) {
      console.error(`Erro ao atualizar ${field} do usuário:`, error);
    }
  };

  if (loading || !currentUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-4">
          <ShieldCheck className="w-10 h-10 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Painel de Administração</h1>
            <p className="text-slate-600 dark:text-slate-300">Gerencie usuários e suas assinaturas.</p>
          </div>
        </div>
      </motion.div>

      <WhatsAppBotPanel />

      <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users /> Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-100 dark:bg-slate-700">
                <tr>
                  <th className="px-6 py-3">Usuário</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">ID Rede</th>
                  <th className="px-6 py-3">Plano</th>
                  <th className="px-6 py-3">Função (Role)</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                    <td className="px-6 py-4 font-medium dark:text-slate-200">{user.full_name}</td>
                    <td className="px-6 py-4 dark:text-slate-200">{user.email}</td>
                    <td className="px-6 py-4">
                      {sharedDataMap[user.id] ? (
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          #{String(sharedDataMap[user.id].number).padStart(2, '0')}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Select
                        value={user.subscription_plan_name || 'free'}
                        onValueChange={(value) => handleFieldChange(user.id, 'subscription_plan_name', value)}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-6 py-4">
                      <Select
                        value={user.role}
                        onValueChange={(value) => handleFieldChange(user.id, 'role', value)}
                        disabled={user.email === 'wagtecaut@gmail.com'}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8">
        <WipeMyDataButton />
      </div>
    </div>
  );
}