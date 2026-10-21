# Autenticação e transporte

Todas as chamadas ao backend partem do servidor Next.js/BFF. Browser usa rotas
locais; JWT Clerk vem da sessão verificada. Access usa `CF_ACCESS_CLIENT_ID` e
`CF_ACCESS_CLIENT_SECRET` apenas no servidor, sem conferir direitos de API.
`BACKEND_BASE_URL` é a origem única, sem alias nem segredo partilhado.

- Leituras públicas `/v1`: sessão opcional; nível decidido por `authorize()`.
- Atlas `/v1/atlas*`: sessão opcional. Sem sessão o backend serve só a projeção da regra 7
  (403 `sign_in_required` para o resto); com sessão o mapa real da semana mais recente
  (403 `pro_required` para histórico e movimento). O ecrã mostra o estado de cada recusa.
- Watchlist, research, AI e analytics: sessão obrigatória, owner verificado no backend.
- Administração: só backoffice com JWT + RBAC PostgreSQL; nenhum service token.
- Geração AI exige `research.ai`; direito comercial vem da projeção Stripe,
  nunca de metadata/claims Clerk.
- Cache pública nunca inclui sessões. Fetch no servidor é no-store; memoização
  React é limitada ao pedido. A prova `BFF_IP_PROOF_KEY` só identifica o orçamento
  de IP, não autoriza rotas/dados; previews não recebem a chave de produção.

`proxy.ts` estabelece contexto Clerk nas rotas que o leem. Uma rota pública pode
ter contexto sem ser protegida; cada BFF privado autentica antes da validação.
Provas: `proxy-auth-context.test.ts`, `backend-origin-proof.test.ts`,
`platform-client.test.ts` e `personal-routes.test.mjs`.

Alertas, CSV, direcionais e antigo proxy synthetic foram apagados. Regresso dos
três primeiros depende da ENG-230. A watchlist mantém-se. Não instalar tokens
antigos. Segredos nunca em browser, argv, logs, git ou respostas.
