import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

export default function ChatDialog({ open, onOpenChange, connection, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (open && connection) {
      loadMessages();
      const interval = setInterval(loadMessages, 3000); // Poll every 3 seconds
      return () => clearInterval(interval);
    }
  }, [open, connection]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadMessages = async () => {
    try {
      const allMessages = await base44.entities.ChatMessage.filter({
        connection_id: connection.id
      });
      
      // Sort by created_date
      allMessages.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      setMessages(allMessages);

      // Mark as read
      const unreadMessages = allMessages.filter(
        m => m.receiver_id === currentUser.id && !m.read
      );
      for (const msg of unreadMessages) {
        await base44.entities.ChatMessage.update(msg.id, { read: true });
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    setLoading(true);
    try {
      const receiverId = connection.from_user_id === currentUser.id 
        ? connection.to_user_id 
        : connection.from_user_id;

      const receiverAnonymousId = connection.from_user_id === currentUser.id
        ? connection.to_anonymous_id
        : connection.from_anonymous_id;

      const senderAnonymousId = connection.from_user_id === currentUser.id
        ? connection.from_anonymous_id
        : connection.to_anonymous_id;

      await base44.entities.ChatMessage.create({
        connection_id: connection.id,
        sender_id: currentUser.id,
        sender_anonymous_id: senderAnonymousId,
        receiver_id: receiverId,
        message: newMessage.trim()
      });

      setNewMessage('');
      await loadMessages();
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const otherUserAnonymousId = connection?.from_user_id === currentUser?.id
    ? connection?.to_anonymous_id
    : connection?.from_anonymous_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Chat com {otherUserAnonymousId}</DialogTitle>
        </DialogHeader>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-slate-50 rounded-lg">
          {messages.map((msg) => {
            const isMe = msg.sender_id === currentUser.id;
            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] px-4 py-2 rounded-lg ${
                    isMe
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-900 border'
                  }`}
                >
                  <p className="text-sm">{msg.message}</p>
                  <p className={`text-xs mt-1 ${isMe ? 'text-blue-100' : 'text-slate-500'}`}>
                    {new Date(msg.created_date).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua mensagem..."
            disabled={loading}
          />
          <Button onClick={sendMessage} disabled={loading || !newMessage.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}