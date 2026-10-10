# Investigação de consumo Vercel — 10/10/2026

## Âmbito e limites da evidência

Revisão do frontoffice e dos contratos/implementação do Backend, histórico Git,
metadata de deployments de produção, captura fornecida pelo Francisco e reprodução
com build de produção e Backend de fixtures do repositório. Nenhum deployment,
configuração de produção, política de autenticação, compra ou operação no servidor
Finance foi executado. Trabalho no branch `codex/vercel-resource-audit`, a partir de
`finance-frontoffice` main `1c156d8259562be09b29cac3ff64a3188e1ed69e`.
Backend consultado: main `a626fb8`; não foi alterado.

Os totais mensais abaixo são os comunicados pelo Francisco, não uma nova extração
independente de billing. A captura `Captura de ecrã 2026-10-10 022124.png`
confirma, nas 12 horas mostradas, `/stocks/[ticker]/events` com cerca de 13 mil
invocações, 10 minutos CPU e 0% erros. Os outros nove resultados visíveis têm
75–166 invocações, exceto `/` com 119. Existem mais páginas na tabela não capturadas.
Uma janela de 12 horas não prova a distribuição de um mês inteiro.

| Medida mensal comunicada | Frontoffice | Limite Hobby comunicado |
| --- | ---: | ---: |
| Fluid Active CPU | 11h55 | 4h |
| Invocações | 1.166.932 | 1.000.000 para a equipa |
| Fast Origin Transfer | 12,64 GB | 10 GB para a equipa |

A equipa totaliza aproximadamente 1,17 milhões de invocações: 607.078 Functions
+ 563.366 Middleware. Fast Origin Transfer total: 12,65 GB, dos quais 11,96 GB
outgoing. `iad1` é a região de execução, não a localização demonstrada dos visitantes.
A captura também mostra CPU P75 62 ms, memória média 381 MB, cold start 0,3%,
menos de 0,1% erros e zero timeouts: não aponta para falhas ou cold starts como
explicação principal naquela janela.

As tentativas de leitura histórica encontraram dois limites reais:

- `get_runtime_logs`: HTTP 400; o Hobby permite apenas a última hora por esta API.
- CLI `vercel metrics ... --aggregation count --group-by route`: `payment_required`,
  exigindo Observability Plus. Nenhum upgrade foi feito.
- Logs recentes consultados devolveram zero registos; isto não demonstra ausência
  de bots ou de pedidos no período anterior à suspensão.

## Problemas confirmados

### 1. Muitos pedidos antecipados sem navegação

`components/calendar/EventCalendar.tsx` apresenta 35–42 links para dias, links
para meses e categorias, todos com o prefetch automático do Next. Cada combinação
de query é um destino diferente da rota dinâmica de eventos. `StockResearchNav`
fazia o mesmo para separadores. `TickerTabSwipe` ainda chamava `router.prefetch`
para os dois vizinhos ao montar, incluindo desktop.

No build de produção anterior às alterações, o teste abriu
`/stocks/QAM/events?month=2026-10`, tornou o calendário visível e esperou pela rede,
sem clicar: **98 pedidos a `/stocks/*`, 95 prefetch, 82 prefetch de eventos**.
Os três pedidos restantes incluem o handshake/redirecionamento de Clerk Development.
A contagem é por browser, não uma contagem de faturação Vercel.
Os 95 prefetch cobrem 53 destinos: 70 pedidos por dia, 12 por mês/filtro e 13
para outros separadores. Há 42 pedidos adicionais para URLs já pedidos; os headers
RSC podem representar fases diferentes de prefetch. Não se assume que todos
renderizem a página inteira. O Next pode obter apenas a árvore até ao loading boundary.

Este mecanismo explica como uma visita pode multiplicar os pedidos à rota
suspeita. A sua contribuição exata para as 1,17 milhões de invocações não pode
ser calculada sem dados históricos de pedidos e visitantes.

Correção: `prefetch={false}` nos links de EventCalendar, WeekBoard,
CalendarLanding e StockResearchNav; remover o prefetch ao montar TickerTabSwipe.
Os hrefs, links HTML, navegação por clique/teclado, gestos e conteúdo mantêm-se.
A primeira navegação para um destino aguarda agora o respetivo pedido; as loading
boundaries continuam presentes. Não foi removida a indexação das páginas.

### 2. Cache de calendário contraditória e eventos/documentos sem cache

`lib/backend.ts` usa `cache: 'no-store'` por omissão. `lib/calendar-events.ts`
passava apenas `next.revalidate: 300`: o resultado tinha opções contraditórias.
O contrato do Next declara que `no-store` e revalidate positivo são incompatíveis.
A intenção de cinco minutos não estava corretamente configurada.

`lib/canonical-research.ts` pedia eventos e disclosures novamente em cada
renderização, usando a omissão no-store, apesar de serem read models públicos
iguais para todos os visitantes.

Correção: cache de dados explícita `force-cache`, 300 segundos no calendário e
60 segundos em eventos/disclosures. O URL completo distingue ticker, intervalo,
categoria e limite. É cache de dados do servidor, não cache pública do HTML
personalizado. A revalidação Next é assíncrona: uma leitura vencida pode servir a
última resposta enquanto revalida, e uma falha de revalidação pode prolongar a
resposta anterior. Estes TTLs não são uma garantia rígida de idade máxima.
As indisponibilidades do contrato continuam a ser representadas como tal.

Não se alterou a omissão no-store, research por owner, watchlists, mutations,
preços, signals, market metrics nem statements. A cache de dados reduz pedidos
repetidos ao Backend e espera/renderização; isoladamente não elimina uma
invocação Function ou os bytes HTML enviados em cada visita.

## Middleware: por que foi preservado

`proxy.ts` cobre dashboard, stocks, calendar e três famílias API com autenticação;
não abrange assets estáticos nem todas as páginas. Não faz consultas SQL ou
rewrites próprios. Clerk precisa deste contexto nas páginas públicas para mostrar
corretamente o estado signed-in, a watchlist e os acessos ao calendário.
Remover `/stocks` ou `/calendar` do matcher já causou uma regressão signed-in
registada nos testes existentes. Não foram retirados esses controlos.
Reduzir os prefetch reduz os pedidos elegíveis para execução do middleware sem
alterar quem pode aceder a cada rota.

## Outros percursos analisados

- Events: summary/fundamentals e eventos, disclosures e calendário em paralelo.
  Não foi encontrado polling, `setInterval` HTTP ou `router.refresh()` automático.
- Signals, relationships, ownership, fundamentals, valuation, rankings, business
  e overview: SSR com helpers de dados e/ou acesso do utilizador. Não foram
  encontrados ciclos automáticos de refetch nestes percursos. Existem diferentes
  políticas de dados; não se converteu toda a família em páginas estáticas.
- Summary já tem cache 120 s, fundamentals 6 h, signals 120 s e OHLC/histórico
  1 h. Não é correto afirmar que o frontend inteiro não tinha cache.
- O intervalo de 530 ms no autocomplete é animação local do cursor, não HTTP.
- Research tem polling de jobs ativos, noutra família de rotas; não explica
  pedidos de eventos nem o aumento anterior à migração JWT de 9 de outubro.
- Analytics já agrega eventos no browser. Não se removeu telemetry nem se
  inventou que cada atualização local gerasse uma Function independente.
- Backend `app/main.py::ticker_events`, `ticker_disclosures` e calendário público
  usam `DataControlEventsService`: consultas limitadas a read models SQL,
  filtradas por ticker/período. Estes endpoints não consultam um provider externo
  por renderização. Não há evidência recolhida que justifique mudar queries,
  remover dados dos payloads ou truncar funcionalidades.
- Eventos/docs são transformados em conteúdo SSR; não se comprovou que payloads
  financeiros excessivos sejam o fator dominante dos 12,65 GB. A eliminação de
  respostas antecipadas é uma redução de transferência mais diretamente demonstrada.

## Cronologia compatível com o aumento

O histórico Git e 39 deployments Production lidos entre 20/09 e 10/10 mostram:

| Data UTC do deployment | Alteração relevante |
| --- | --- |
| 30/09 00:04 | `440d5a4` integra calendários; código `c95dd58` introduz os links por dia |
| 04/10 00:16, 21:12, 21:57 | PRs 53–55, expansão das páginas research |
| 05/10 | Novas páginas e padrões research, incluindo Events (`2649b98`) |
| 07/10 | Swipe (`2e46fd1`) acrescenta prefetch dos vizinhos; quatro deployments Production |
| 08/10 16:42 | `2b82624`, PR 65: calendário semanal e navegação por eventos |
| 09/10 14:29 | `1c156d8`, PR 66: JWT opcional, BFF continua por omissão |

A coincidência temporal apoia investigar estes mecanismos; não prova causalidade
mensal nem exclui mudanças no tráfego. A migração JWT mais recente não pode
explicar um aumento que já ocorria em setembro e no início de outubro.

## Bots, SEO e o que ainda é desconhecido

Não foram obtidos user-agents, IPs ou referrers históricos. Bots abusivos continuam
uma hipótese. Calendários também oferecem muitas combinações de mês/dia a um
crawler; retirar prefetch não impede um crawler de seguir links HTML.
Não se bloquearam crawlers, origens ou IPs sem prova, nem se alteraram robots/sitemap.
Não se deve prometer que estas correções, por si só, mantêm a plataforma no gratuito.

## Verificação e medição depois da correção

Ambiente: Node v22.23.1, npm 10.9.8, Next 16.2.12; dependências instaladas com
`npm ci`, como na CI. O teste novo guarda só pathname
mais month/day/type, sem cookies, tokens, headers de autenticação ou handshake Clerk.
Os artefactos de runtime ficam em `test-results/resource-audit/` gitignored.

Comandos executados:

```sh
npm ci
# Antes: 277 unitários; 166 browser PASS, 29 SKIP.
PLAYWRIGHT_SERVER_MODE=production npm run qa:frontend
# Depois: mesmas fases e flags de captura/keyless da CI.
PLAYWRIGHT_SERVER_MODE=production PLAYWRIGHT_CAPTURE=1 NEXT_PUBLIC_CLERK_KEYLESS_DISABLED=1 npm run qa:frontend
git diff --check
```

Lint: zero erros, um warning já existente (`lib/technicalSignals.ts`, `takeLast`).
Typecheck e build de produção passaram. Depois da alteração, 280 testes
unitários/contratuais passaram, zero falhas ou skips. Três testes novos cobrem
prefetch dos links/swipe, TTLs públicos e preservação de no-store nas mutations.
A execução usa dois workers locais (configuração existente); a CI usa um.
Não se executou Python CI: não há alterações no Backend ou noutros repos Python.
`npm ci` reportou 16 advisories no conjunto de dependências existente; não foram
feitas atualizações de dependências ou `audit fix` neste trabalho.

Comparação do mesmo cenário de calendário antes de clicar:

| Medida local | Antes | Depois |
| --- | ---: | ---: |
| Pedidos `/stocks/*` | 98 | 3 |
| Prefetch | 95 | 0 |
| Prefetch de eventos | 82 | 0 |

Redução de **96,9% dos pedidos `/stocks/*` neste cenário**, eliminando os 95
pedidos antecipados. Os três pedidos restantes são abertura/handshake Clerk
Development. Hover não antecipou pedidos; clicar num dia alterou o URL e o dia
selecionado corretamente. Não se mediu faturação, CPU Fluid ou Fast Origin Transfer
em bytes neste ensaio.

Suite completa de browser: **166 PASS, 29 SKIP existentes, zero falhas**, em 4,4
minutos. Inclui navegação bidirecional por swipe, gestos que não devem navegar,
calendário público/locked e layouts responsivos. A nova verificação de ausência
de prefetch, hover e seleção de dia passou. Não foi feito um novo ensaio signed-in
com duas contas neste trabalho; a configuração de autenticação e o matcher ficaram
intactos, cobertos pelas verificações existentes de contexto e rotas protegidas.
A revisão React preservou os server components, o escopo dos handlers de touch,
as dependências do efeito e os links semânticos. Não acrescentou dependências,
serialização de dados ou waterfalls.

`git diff --check` passou. Os seis PNGs de feedback que a suite escreve no
repositório foram restaurados à versão original para manter o diff limitado ao
trabalho pedido. Os servidores owned de QA terminaram com a suite. Não fica
localhost a servir esta verificação.

Entrega: alterações no branch acima, com commit, push e PR autorizados pelo
Francisco após o diagnóstico. O relatório e os testes acompanham o código.
A revisão e publicação, o acompanhamento de métricas e qualquer ação para
levantar a suspensão continuam por executar. Não se fez merge ou deploy manual.

## Impacto esperado e acompanhamento

O efeito diretamente esperado é eliminar os prefetch cobertos: menos pedidos à
Function e ao Middleware e menos respostas compute → CDN. CPU e transferência
mensais devem ser medidas depois de uma versão revista ser publicada pelo operador.
Uma percentagem de redução de pedidos no cenário local não é uma percentagem de
redução do consumo mensal, nem é uma medição dos bytes de Fast Origin Transfer.

Para caber nos valores comunicados seria necessária aproximadamente uma redução
mensal de **66% CPU**, **15% invocações** e **21% Fast Origin Transfer** da equipa.
São metas de capacidade, não resultados já alcançados. Se as visitas reais,
crawlers e outras Functions continuarem acima desses valores, o gratuito pode
não ser tecnicamente suficiente. A elegibilidade do Hobby também depende do uso
pessoal/não comercial previsto no plano.

Plano de acompanhamento sem instalar serviços pagos:

1. Antes de publicar, guardar Usage acumulado e as 12 h disponíveis de Functions:
   invocações por rota, Active CPU e transferência. Anotar SHA, hora e ambiente.
2. Após publicação pelo operador, repetir com janelas de duração igual (1 h, 12 h,
   24 h e 7 dias), evitando comparar dias de suspensão com dias normais.
3. Distinguir pedidos RSC/prefetch, HTML e APIs; procurar query day/month, cadência,
   user-agent e referrer nos logs ainda retidos. Não exportar cookies/tokens.
4. Acompanhar também `/api/analytics/event`, overview e restantes tabs: não assumir
   que a eliminação do pico de events resolveu toda a equipa.
5. Sem retenção paga, manter um registo diário manual do dashboard durante a
   observação. Rever o orçamento aos 70% e 85% dos limites, considerando o consumo
   diário e os dias restantes. Não há alertas automáticos novos configurados.
6. Se houver prova de abuso, propor regras Firewall específicas e rever bots
   verificados/SEO antes de ativar. Não aplicar uma regra indiscriminada agora.
7. Não provocar um redeploy repetido ou teste de carga em produção para medir custos.
   As otimizações não removem automaticamente a suspensão nem repõem a quota usada.

## Referências técnicas

- [Next.js prefetch](https://nextjs.org/docs/app/guides/prefetching)
- [Next.js fetch e opções de cache](https://nextjs.org/docs/app/api-reference/functions/fetch)
- Guias da versão instalada em `node_modules/next/dist/docs/`, Next 16.2.12.
- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- [Vercel utilização CDN](https://vercel.com/docs/manage-cdn-usage)
