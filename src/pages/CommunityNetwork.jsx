import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  UserPlus,
  CheckCircle,
  XCircle,
  Clock,
  MessageCircle,
  Trash2,
  Camera
} from "lucide-react";
import ChatDialog from "../components/chat/ChatDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import AvatarPickerDialog from '../components/network/AvatarPickerDialog';

const UserAvatar = ({ avatarUrl, size = "md", number }) => {
  const sizeClasses = { sm: "w-10 h-10 text-lg", md: "w-14 h-14 text-2xl", lg: "w-20 h-20 text-4xl" };
  const isUrl = avatarUrl && (avatarUrl.startsWith('http') || avatarUrl.startsWith('/'));
  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm shrink-0`}>
      {avatarUrl
        ? isUrl
          ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
          : <span>{avatarUrl}</span>
        : <span className="text-white font-bold text-sm">{number ? `#${String(number).padStart(2, '0')}` : '?'}</span>
      }
    </div>
  );
};

const formatId = (num) => num ? `#${String(num).padStart(2, '0')}` : '—';

const categoryLabels = {
  food: 'Alimentação', transport: 'Transporte', health: 'Saúde',
  education: 'Educação', entertainment: 'Lazer', shopping: 'Compras',
  bills: 'Contas', rent: 'Aluguel', other_expense: 'Outros'
};

export default function CommunityNetwork() {
  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // includes self for number lookup
  const [myData, setMyData] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [connectionRequests, setConnectionRequests] = useState([]);
  const [myConnections, setMyConnections] = useState([]);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      const allSharedData = await base44.entities.SharedFinancialData.list('-created_date', 200);
      // Sort by created_date ascending to assign display numbers
      const sorted = [...allSharedData].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

      // Assign display_number if missing (persist only for own record)
      const myShared = sorted.find(u => u.user_id === user.id);
      const otherUsers = sorted.filter(u => u.user_id !== user.id);

      // Give each user a sequential number based on index in sorted list
      const withNumbers = sorted.map((u, idx) => ({ ...u, _displayNumber: idx + 1 }));
      setAllUsers(withNumbers);

      if (myShared) {
        const myWithNumber = withNumbers.find(u => u.user_id === user.id);
        setMyData(myWithNumber);
        // Persist display_number if not set
        if (!myShared.display_number) {
          await base44.entities.SharedFinancialData.update(myShared.id, {
            display_number: myWithNumber._displayNumber
          });
        }
      }

      const requests = await base44.entities.ConnectionRequest.list();
      setConnectionRequests(requests);

      const accepted = requests.filter(r =>
        r.status === 'accepted' &&
        (r.from_user_id === user.id || r.to_user_id === user.id)
      );
      setMyConnections(accepted);

      setUsers(withNumbers.filter(u => u.user_id !== user.id));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const sendConnectionRequest = async (toUser) => {
    const existing = connectionRequests.find(r =>
      (r.from_user_id === currentUser.id && r.to_user_id === toUser.user_id) ||
      (r.to_user_id === currentUser.id && r.from_user_id === toUser.user_id)
    );
    if (existing) { alert('Você já enviou uma solicitação para este usuário ou já está conectado.'); return; }
    const message = prompt('Escreva uma mensagem de apresentação (opcional):');
    await base44.entities.ConnectionRequest.create({
      from_user_id: currentUser.id,
      from_anonymous_id: myData.anonymous_id,
      to_user_id: toUser.user_id,
      to_anonymous_id: toUser.anonymous_id,
      status: 'pending',
      message: message || ''
    });
    alert('Solicitação enviada com sucesso!');
    await loadData();
  };

  const handleRequest = async (requestId, status) => {
    await base44.entities.ConnectionRequest.update(requestId, { status });
    await loadData();
  };

  const confirmDeleteConnection = (connection) => {
    setConnectionToDelete(connection);
    setShowDeleteDialog(true);
  };

  const deleteConnection = async () => {
    if (!connectionToDelete) return;
    await base44.entities.ConnectionRequest.delete(connectionToDelete.id);
    setShowDeleteDialog(false);
    setConnectionToDelete(null);
    await loadData();
  };

  const handleSaveAvatar = async (avatarUrl) => {
    if (!myData) return;
    await base44.entities.SharedFinancialData.update(myData.id, { avatar_url: avatarUrl });
    await loadData();
  };

  const viewUserDetails = (user) => { setSelectedUser(user); setShowDetailsDialog(true); };

  const isConnected = (userId) => myConnections.some(c => c.from_user_id === userId || c.to_user_id === userId);
  const hasPendingRequest = (userId) => connectionRequests.some(r =>
    r.status === 'pending' &&
    ((r.from_user_id === currentUser?.id && r.to_user_id === userId) ||
     (r.to_user_id === currentUser?.id && r.from_user_id === userId))
  );

  const pendingRequestsToMe = connectionRequests.filter(r =>
    r.to_user_id === currentUser?.id && r.status === 'pending'
  );

  if (!myData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-slate-400" />
              <h2 className="text-2xl font-bold mb-2">Compartilhe seus dados primeiro</h2>
              <p className="text-slate-600">Você precisa compartilhar seus dados financeiros para acessar a rede.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* My avatar with edit button */}
            <div className="relative">
              <UserAvatar avatarUrl={myData.avatar_url} size="md" number={myData._displayNumber} />
              <button
                onClick={() => setShowAvatarPicker(true)}
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center shadow-md transition-colors"
              >
                <Camera className="w-3 h-3 text-white" />
              </button>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Rede de Usuários</h1>
              <p className="text-slate-600 dark:text-slate-300">
                Seu ID: <span className="font-bold text-blue-600">{formatId(myData._displayNumber)}</span>
              </p>
            </div>
          </div>
          <Badge className="text-base px-4 py-2 self-start sm:self-auto">
            <Users className="w-4 h-4 mr-2" />
            {users.filter(u => u.is_sharing !== false).length} usuários compartilhando
          </Badge>
        </div>

        <Tabs defaultValue="network" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="network">Rede</TabsTrigger>
            <TabsTrigger value="requests">
              Solicitações {pendingRequestsToMe.length > 0 && `(${pendingRequestsToMe.length})`}
            </TabsTrigger>
            <TabsTrigger value="connections">Minhas Conexões</TabsTrigger>
          </TabsList>

          {/* NETWORK TAB */}
          <TabsContent value="network" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {users.filter(u => u.is_sharing !== false).map((user) => (
                <Card key={user.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar avatarUrl={user.avatar_url} size="sm" number={user._displayNumber} />
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base">{formatId(user._displayNumber)}</CardTitle>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.anonymous_id}</p>
                      </div>
                      {(user.savings_rate || 0) > 0
                        ? <TrendingUp className="w-5 h-5 text-green-600 shrink-0" />
                        : <TrendingDown className="w-5 h-5 text-red-600 shrink-0" />
                      }
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Taxa de Poupança:</span>
                        <span className={`font-bold ${(user.savings_rate || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(user.savings_rate || 0).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Meses rastreados:</span>
                        <span className="font-semibold">{user.months_tracked || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Gasto médio/mês:</span>
                        <span className="font-semibold">R$ {(user.monthly_average_expense || 0).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => viewUserDetails(user)} variant="outline" size="sm" className="flex-1">
                        Ver Detalhes
                      </Button>
                      {isConnected(user.user_id) ? (
                        <Badge className="flex-1 justify-center bg-green-100 text-green-700">Conectado</Badge>
                      ) : hasPendingRequest(user.user_id) ? (
                        <Badge className="flex-1 justify-center bg-yellow-100 text-yellow-700">Pendente</Badge>
                      ) : (
                        <Button onClick={() => sendConnectionRequest(user)} size="sm" className="flex-1">
                          <UserPlus className="w-4 h-4 mr-1" />
                          Conectar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* REQUESTS TAB */}
          <TabsContent value="requests" className="space-y-4">
            {pendingRequestsToMe.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Clock className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-600">Nenhuma solicitação pendente</p>
                </CardContent>
              </Card>
            ) : (
              pendingRequestsToMe.map((request) => {
                const fromUser = allUsers.find(u => u.user_id === request.from_user_id);
                return (
                  <Card key={request.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <UserAvatar avatarUrl={fromUser?.avatar_url} size="sm" number={fromUser?._displayNumber} />
                          <div>
                            <p className="font-bold text-lg">{formatId(fromUser?._displayNumber)}</p>
                            <p className="text-sm text-slate-600">quer se conectar com você</p>
                            {request.message && (
                              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                                <p className="text-sm text-slate-700 dark:text-slate-300">{request.message}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button onClick={() => handleRequest(request.id, 'accepted')} size="sm" className="bg-green-600 hover:bg-green-700">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Aceitar
                          </Button>
                          <Button onClick={() => handleRequest(request.id, 'rejected')} size="sm" variant="outline" className="text-red-600">
                            <XCircle className="w-4 h-4 mr-1" />
                            Recusar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* CONNECTIONS TAB */}
          <TabsContent value="connections" className="space-y-4">
            {myConnections.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Users className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-600">Você ainda não tem conexões</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {myConnections.map((connection) => {
                  const connectedUserId = connection.from_user_id === currentUser.id
                    ? connection.to_user_id
                    : connection.from_user_id;
                  const connectedUser = allUsers.find(u => u.user_id === connectedUserId);

                  if (!connectedUser) {
                    return (
                      <Card key={connection.id}>
                        <CardContent className="p-6 text-center text-slate-500">
                          <p className="text-sm">Usuário ainda não compartilhou seus dados</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-3 text-red-500 hover:text-red-700 gap-1"
                            onClick={() => confirmDeleteConnection(connection)}
                          >
                            <Trash2 className="w-4 h-4" />
                            Remover
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  }

                  return (
                    <Card key={connection.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar avatarUrl={connectedUser.avatar_url} size="sm" number={connectedUser._displayNumber} />
                          <div className="flex-1">
                            <CardTitle className="text-base">{formatId(connectedUser._displayNumber)}</CardTitle>
                            <p className="text-xs text-slate-500 truncate">{connectedUser.anonymous_id}</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">Receitas:</span>
                            <span className="font-semibold text-green-600">R$ {(connectedUser.total_income || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">Despesas:</span>
                            <span className="font-semibold text-red-500">R$ {(connectedUser.total_expense || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">Taxa Poupança:</span>
                            <span className={`font-bold ${(connectedUser.savings_rate || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {(connectedUser.savings_rate || 0).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button onClick={() => viewUserDetails(connectedUser)} variant="outline" size="sm" className="flex-1">
                            Ver Perfil
                          </Button>
                          <Button
                            onClick={() => { setSelectedConnection(connection); setShowChatDialog(true); }}
                            size="sm"
                            className="flex-1"
                          >
                            <MessageCircle className="w-4 h-4 mr-1" />
                            Chat
                          </Button>
                          <Button
                            onClick={() => confirmDeleteConnection(connection)}
                            variant="outline"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 px-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Chat Dialog */}
      {selectedConnection && (
        <ChatDialog
          open={showChatDialog}
          onOpenChange={setShowChatDialog}
          connection={selectedConnection}
          currentUser={currentUser}
        />
      )}

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedUser && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <UserAvatar avatarUrl={selectedUser.avatar_url} size="md" number={selectedUser._displayNumber} />
                  <div>
                    <DialogTitle className="text-2xl">{formatId(selectedUser._displayNumber)}</DialogTitle>
                    <DialogDescription>{selectedUser.anonymous_id}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card><CardContent className="p-4 text-center">
                    <DollarSign className="w-8 h-8 mx-auto mb-2 text-green-600" />
                    <p className="text-sm text-slate-600">Receitas</p>
                    <p className="text-lg font-bold">R$ {(selectedUser.total_income || 0).toFixed(2)}</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-4 text-center">
                    <DollarSign className="w-8 h-8 mx-auto mb-2 text-red-600" />
                    <p className="text-sm text-slate-600">Despesas</p>
                    <p className="text-lg font-bold">R$ {(selectedUser.total_expense || 0).toFixed(2)}</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-4 text-center">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                    <p className="text-sm text-slate-600">Taxa Poupança</p>
                    <p className="text-lg font-bold">{(selectedUser.savings_rate || 0).toFixed(1)}%</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-4 text-center">
                    <Users className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                    <p className="text-sm text-slate-600">Meses</p>
                    <p className="text-lg font-bold">{selectedUser.months_tracked || 0}</p>
                  </CardContent></Card>
                </div>
                {selectedUser.financial_evolution?.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle>Evolução Financeira</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={selectedUser.financial_evolution}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="income" fill="#10b981" name="Receitas" />
                          <Bar dataKey="expense" fill="#ef4444" name="Despesas" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
                {selectedUser.category_spending && (
                  <Card>
                    <CardHeader><CardTitle>Gastos por Categoria</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(selectedUser.category_spending).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
                          <div key={cat} className="flex items-center justify-between">
                            <span className="text-slate-700 dark:text-slate-300">{categoryLabels[cat] || cat}</span>
                            <div className="flex items-center gap-3">
                              <div className="w-32 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(amount / (selectedUser.total_expense || 1)) * 100}%` }} />
                              </div>
                              <span className="font-bold text-slate-900 dark:text-white w-24 text-right">R$ {amount.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Connection Confirm */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover conexão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá desfazer a conexão com este usuário. Você precisará enviar uma nova solicitação para se reconectar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteConnection} className="bg-red-600 hover:bg-red-700">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Avatar Picker */}
      <AvatarPickerDialog
        open={showAvatarPicker}
        onOpenChange={setShowAvatarPicker}
        currentAvatar={myData?.avatar_url}
        onSave={handleSaveAvatar}
      />
    </div>
  );
}