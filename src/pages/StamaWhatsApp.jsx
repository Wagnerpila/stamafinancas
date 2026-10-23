import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Trash2, ArrowRight, Check, Loader2, UserPlus } from "lucide-react";
import { api } from "@/api/apiClient";
import { User, CategoryRule } from "@/api/entities";
import { Input } from "@/components/ui/input";
import { createPageUrl } from "@/utils";
import { AgentBubble } from "../components/agents/agents";

function formatPhone(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  const m = d.match(/^(55)?(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `${m[1] ? "55 " : ""}${m[2]} ${m[3]}-${m[4]}` : d;
}

// Cartão de contato (.vcf) pro usuário salvar o número do Stama com um toque.
function vcardHref(number) {
  const card = ["BEGIN:VCARD", "VERSION:3.0", "FN:Stama Financeiro", `TEL;TYPE=CELL:+${number}`, "END:VCARD"].join("\n");
  return `data:text/vcard;charset=utf-8,${encodeURIComponent(card)}`;
}

const EXAMPLES = [
  { group: "Registrar", items: ["gastei 62 na farmácia", "almoço 141,60 no cartão do Itaú", "tv 2400 em 10x no Nubank", "recebi 3000 de salário", "uber 23 e lanche 18"] },
  { group: "Consultar", items: ["como estou esse mês?", "quanto gastei de mercado?", "gastos por categoria do mês passado", "estourei o orçamento?", "quanto tenho de parcelas?"] },
  { group: "Contas", items: ["aluguel 1500 todo dia 10", "o que vence esse mês?", "paguei a luz"] },
  { group: "Lembretes", items: ["me lembra de ligar pro contador amanhã às 10h", "toda segunda 8h me lembra da reunião", "o que tenho pra hoje?"] },
  { group: "Corrigir", items: ["na verdade foi 50", "isso é Mercado", "apaga esse"] },
];

export default function StamaWhatsApp() {
  const [user, setUser] = useState(null);
  const [info, setInfo] = useState(null);
  const [number, setNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState([]);
  const [link, setLink] = useState(null);
  const [relink, setRelink] = useState(false);

  // Enquanto há um código pendente, confere de tempos em tempos se o bot já recebeu a mensagem.
  useEffect(() => {
    if (!link) return undefined;
    const startedAt = Date.now();
    const timer = setInterval(async () => {
      try {
        const me = await User.me();
        if (me.whatsapp_verified_at && new Date(me.whatsapp_verified_at).getTime() >= startedAt - 60000) {
          setUser(me);
          setLink(null);
          setRelink(false);
        }
      } catch {
        // tenta de novo no próximo ciclo
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [link]);

  useEffect(() => {
    (async () => {
      try {
        const me = await User.me();
        setUser(me);
        setNumber(me.whatsapp_number || "");
        setRules(await CategoryRule.filter({ created_by: me.email }, "keyword"));
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      }
      try {
        setInfo(await api.get("/whatsapp/info"));
      } catch {
        setInfo({ connected: false });
      }
    })();
  }, []);

  const requestCode = async () => {
    setSaving(true);
    try {
      setLink(await api.post("/whatsapp/link", { number }));
    } catch (err) {
      alert(err.message || "Não foi possível gerar o código.");
    } finally {
      setSaving(false);
    }
  };

  const removeRule = async (rule) => {
    await CategoryRule.delete(rule.id);
    setRules((r) => r.filter((x) => x.id !== rule.id));
  };

  const botLink = info?.phoneNumber ? `https://wa.me/${info.phoneNumber}?text=${encodeURIComponent("oi")}` : null;
  const firstName = user?.full_name?.split(" ")[0] || "";

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-4 md:p-8">
      <section className="space-y-6">
        <p className="section-label">Stama no WhatsApp</p>
        <h1 className="font-display text-3xl font-semibold leading-tight text-slate-900 dark:text-white sm:text-4xl">
          Fale com ele como fala com <span className="text-brand-700 dark:text-brand-300">qualquer pessoa</span>.
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-300">
          Texto, áudio ou foto do comprovante — sem comandos. Ele registra, responde suas dúvidas, cuida das contas e te lembra do que importa.
        </p>

        <AgentBubble agent="stama">
          {info?.connected ? (
            <>oi{firstName ? `, ${firstName}` : ""}! me chama no WhatsApp quando quiser — eu e a equipe (Bia nas finanças, Otto na agenda) já estamos de plantão.</>
          ) : (
            <>estou fora do ar no momento. Assim que o administrador conectar o WhatsApp, é só me chamar.</>
          )}
        </AgentBubble>

        <div className="flex flex-wrap items-center gap-3">
          {botLink ? (
            <a href={botLink} target="_blank" rel="noreferrer" className="pill-primary">
              <MessageCircle className="h-4 w-4" /> Abrir conversa
            </a>
          ) : (
            <span className="pill-outline cursor-default opacity-60">
              <MessageCircle className="h-4 w-4" /> Bot desconectado
            </span>
          )}
          <Link to={createPageUrl("NotificationSettings")} className="pill-outline">
            Avisos e resumos
          </Link>
        </div>
      </section>

      <section className="space-y-5">
        <p className="section-label">Vincular seu WhatsApp</p>
        {user?.whatsapp_verified_at && !link ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 font-display text-sm font-medium text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
              <Check className="h-4 w-4" /> Vinculado{user.whatsapp_number ? ` ao ${formatPhone(user.whatsapp_number)}` : ""}
            </span>
            <button type="button" onClick={() => setRelink(true)} className="text-sm font-medium text-slate-500 underline-offset-4 hover:underline">
              trocar número
            </button>
          </div>
        ) : null}

        {(!user?.whatsapp_verified_at || relink) && !link && (
          <>
            <p className="text-slate-600 dark:text-slate-300">
              <strong className="text-slate-900 dark:text-white">1.</strong> Informe seu número de WhatsApp com DDD.
            </p>
            <div className="flex gap-2 sm:max-w-md">
              <Input
                type="tel"
                inputMode="tel"
                placeholder="11999998888"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="h-12 rounded-full px-5 text-base"
              />
              <button type="button" onClick={requestCode} disabled={saving || number.replace(/\D/g, "").length < 10} className="pill-primary shrink-0 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Gerar código
              </button>
            </div>
          </>
        )}

        {link && (
          <div className="space-y-5 rounded-3xl border border-slate-200/80 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 sm:p-6">
            <div>
              <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">2. Salve o número do Stama</p>
              {link.botNumber ? (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="font-display text-2xl font-semibold text-slate-900 dark:text-white">+{formatPhone(link.botNumber)}</span>
                  <a href={vcardHref(link.botNumber)} download="stama.vcf" className="pill-outline !py-1.5">
                    <UserPlus className="h-4 w-4" /> Adicionar aos contatos
                  </a>
                </div>
              ) : (
                <p className="mt-2 text-amber-700">O bot ainda não está conectado. Peça ao administrador para conectar o WhatsApp no Painel Admin.</p>
              )}
            </div>
            <div>
              <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">3. Envie este código pelo WhatsApp</p>
              <p className="mt-2 font-display text-5xl font-bold tracking-[0.3em] text-brand-700 dark:text-brand-300">{link.code}</p>
              <p className="mt-1 text-sm text-slate-500">Vale por 30 minutos.</p>
            </div>
            {link.botNumber && (
              <a href={`https://wa.me/${link.botNumber}?text=${encodeURIComponent(`Meu código: ${link.code}`)}`} target="_blank" rel="noreferrer" className="pill-primary">
                <MessageCircle className="h-4 w-4" /> Enviar código no WhatsApp
              </a>
            )}
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Aguardando sua mensagem…
            </p>
          </div>
        )}
      </section>

      <section className="space-y-5">
        <p className="section-label">O que pedir</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {EXAMPLES.map((g) => (
            <div key={g.group} className="rounded-3xl border border-slate-200/80 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <p className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{g.group}</p>
              <ul className="space-y-2">
                {g.items.map((ex) => (
                  <li key={ex} className="w-fit rounded-2xl rounded-tr-none bg-brand-50 px-3 py-1.5 text-[15px] text-slate-800 dark:bg-brand-900/40 dark:text-slate-100">
                    {ex}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <p className="section-label">O que ele aprendeu</p>
        {rules.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-300">
            Quando você corrige uma categoria pelo WhatsApp ("isso é Mercado"), ele anota aqui e acerta das próximas vezes.
          </p>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-900">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 last:border-0 dark:border-slate-800">
                <span className="flex-1 text-slate-800 dark:text-slate-100">
                  “{rule.keyword}” <ArrowRight className="mx-1 inline h-4 w-4 text-slate-400" />
                  <strong>{rule.category}</strong>
                  <span className="ml-2 text-xs text-slate-400">{rule.type === "income" ? "receita" : "despesa"}</span>
                </span>
                <button type="button" onClick={() => removeRule(rule)} className="rounded-full p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Esquecer">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
