# Autenticação e transporte

Todas as chamadas ao backend partem do servidor Next.js/BFF. Browser usa rotas
locais; JWT Clerk vem da sessão verificada. Access usa `CF_ACCESS_CLIENT_ID` e
`CF_ACCESS_CLIENT_SECRET` apenas no servidor, sem conferir direitos de API.
`BACKEND_BASE_URL` é a origem única, sem alias nem segredo partilhado.

- Leituras públicas `/v1`: sessão opcional; nível decidido por `authorize()`.
- Mapa `/v1/network*` e `/v1/relationships/*`: sessão obrigatória, até à ENG-228.
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
