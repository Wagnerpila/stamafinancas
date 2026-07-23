import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Check } from "lucide-react";
import { base44 } from '@/api/base44Client';

const PRESET_AVATARS = [
  "🐶", "🐱", "🦊", "🐻", "🐼", "🐨", "🦁", "🐸",
  "🦋", "🦄", "🐧", "🦉", "🐺", "🐮", "🐯", "🦊",
  "🌟", "🔥", "💎", "🚀", "🌈", "⚡", "🎯", "💡"
];

export default function AvatarPickerDialog({ open, onOpenChange, currentAvatar, onSave }) {
  const [selected, setSelected] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileRef = useRef();

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setPreviewUrl(file_url);
    setSelected(file_url);
    setUploading(false);
  };

  const handleSave = () => {
    if (selected) onSave(selected);
    onOpenChange(false);
  };

  const isUrl = (v) => v && (v.startsWith('http') || v.startsWith('/'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Avatar</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current / Preview */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-4xl overflow-hidden border-4 border-blue-400">
              {(previewUrl || currentAvatar) ? (
                isUrl(previewUrl || currentAvatar)
                  ? <img src={previewUrl || currentAvatar} alt="avatar" className="w-full h-full object-cover" />
                  : <span>{previewUrl || currentAvatar}</span>
              ) : <span>👤</span>}
            </div>
          </div>

          {/* Upload photo */}
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Enviar foto</p>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => fileRef.current.click()}
              disabled={uploading}
            >
              <Upload className="w-4 h-4" />
              {uploading ? "Enviando..." : "Escolher imagem"}
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </div>

          {/* Preset emojis */}
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Ou escolha um avatar</p>
            <div className="grid grid-cols-8 gap-2">
              {PRESET_AVATARS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { setSelected(emoji); setPreviewUrl(null); }}
                  className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors relative ${selected === emoji ? 'bg-blue-100 dark:bg-blue-800 ring-2 ring-blue-500' : 'bg-slate-100 dark:bg-slate-700'}`}
                >
                  {emoji}
                  {selected === emoji && <Check className="absolute -top-1 -right-1 w-3 h-3 text-blue-600 bg-white rounded-full" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={!selected}>Salvar Avatar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}