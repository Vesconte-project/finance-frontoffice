# Research nativo

O contrato antigo `/site/research/synthetic/*` e o proxy equivalente foram apagados.
A página de comparação usa apenas `/v1/research/*`, pela sessão Clerk e BFF nativo.
Não há modos de compatibilidade, PEM fixada ou shared secret.
Ver [authentication.md](authentication.md) e o manifesto de ativação em finance-infra.
Ensaios usam exclusivamente Clerk Development e fixtures sintéticas v2.
