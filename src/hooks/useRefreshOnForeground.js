import { useEffect, useRef } from "react";

/**
 * Reexecuta `callback` quando a página volta a ficar visível depois de ter sido restaurada do
 * bfcache (back/forward cache) do navegador, ou depois de voltar do segundo plano.
 *
 * Isso importa especialmente no mobile: ao trocar de tela dentro do app e voltar (ex: gesto de
 * "voltar" do Android, ou o app ficando minimizado e retomado), o navegador com frequência
 * restaura a página do bfcache em vez de remontar o componente — o React nunca reexecuta o
 * useEffect de carregamento inicial, então a tela fica presa nos dados buscados antes da
 * navegação (ex: um card de "Compromissos Futuros" que não reflete uma conta criada na tela
 * anterior, ou uma lista de contas que não sabe que algo foi pago em outra aba/dispositivo).
 *
 * `pageshow` com `event.persisted === true` é o sinal padrão de restauração via bfcache;
 * `visibilitychange` cobre o caso do app voltando de segundo plano sem bfcache.
 */
export default function useRefreshOnForeground(callback) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const handlePageShow = (event) => {
      if (event.persisted) callbackRef.current();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") callbackRef.current();
    };

    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);
}
