# Política de Segurança — Restaurant POS System

## Versões suportadas

| Versão | Suporte de segurança |
|---|---|
| `main` (atual) | ✅ Ativo |
| branches de feature | ❌ Não — reportar na `main` |

## Como reportar uma vulnerabilidade

**Não abra uma issue pública para vulnerabilidades de segurança.**

Para reportar uma vulnerabilidade:

1. Envie um e-mail descrevendo o problema com o título `[SECURITY] Restaurant POS System — <resumo>`.
2. Inclua:
   - Descrição do problema e impacto potencial
   - Passos para reproduzir
   - Componente afetado (arquivo, endpoint, módulo)
   - Classificação de severidade sugerida (Crítico / Alto / Médio / Baixo)
3. Aguarde confirmação de recebimento em até **5 dias úteis**.
4. A vulnerabilidade será corrigida e uma entrada `Security` será adicionada ao `CHANGELOG.md` após o fix.

## Vulnerabilidades conhecidas e pendentes

As seguintes vulnerabilidades foram identificadas internamente e estão sendo tratadas:

| ID | Componente | Descrição | Status |
|---|---|---|---|
| SEC-001 | `pos-backend/.env` | Credenciais do MongoDB Atlas e JWT_SECRET commitados no repositório | 🔴 Em tratamento |
| SEC-002 | `routes/userRoute.js` | Sem rate limiting em login e registro | 🔴 Em tratamento |
| SEC-003 | `routes/pdvRoutes.js` | Ausência de `storeIsolation` middleware | 🔴 Em tratamento |
| SEC-004 | `app.js` | Socket.io sem autenticação de handshake | 🔴 Em tratamento |
| SEC-005 | `routes/subscriptionRoutes.js` | Endpoint `/seed` sem restrição de masterAdmin | 🟠 Em tratamento |

## Práticas de segurança esperadas para contribuidores

- Nunca commitar arquivos `.env` ou qualquer arquivo contendo credenciais reais
- Nunca hardcodar segredos, senhas ou chaves de API no código fonte
- Usar `openssl rand -hex 32` para gerar `JWT_SECRET`
- Toda nova rota que acessa dados de loja deve incluir o middleware `storeIsolation`
- Validar `razorpay_signature` com HMAC-SHA256 em qualquer webhook de pagamento
