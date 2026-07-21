# ADR-0003: Autenticação JWT via Cookie httpOnly

- Status: Accepted
- Date: 2026-04-01 (reconstituído — ver middlewares/tokenVerification.js, controllers/userController.js)
- Decision owners: Arquiteto backend
- Related components: `middlewares/tokenVerification.js`, `controllers/userController.js`, `middlewares/deviceApproval.js`

## Context

O sistema precisa autenticar requisições de um SPA React (pos-frontend) e um painel Next.js (pos-admin) que se comunicam com o backend Express. A estratégia de autenticação deve proteger o token de XSS e funcionar com comunicação cross-origin.

## Decision

Armazenar o JWT em cookie `httpOnly; Secure; SameSite` em vez de `localStorage`.

Configuração do cookie:
- `httpOnly: true` — inacessível via JavaScript, protege de XSS.
- `secure: true` em produção (`NODE_ENV=production`), `false` em desenvolvimento.
- `sameSite: 'none'` em produção (cross-origin entre frontend e backend), `'lax'` em desenvolvimento.
- `maxAge: 30 dias` (tempo de vida do cookie).
- JWT `expiresIn: '1d'` (o token em si expira em 1 dia).

O middleware `tokenVerification.js` extrai o token do cookie (`req.cookies.accessToken`) ou do header `Authorization: Bearer`.

## Alternatives considered

1. **localStorage** — descartado por vulnerabilidade a XSS. Token acessível por qualquer script na página.
2. **sessionStorage** — mesma vulnerabilidade de XSS que localStorage; perdido ao fechar a aba.
3. **Bearer token em header sem cookie** — requer lógica de refresh explícita no cliente; mais exposto.

## Consequences

### Positive

- Token não acessível via JavaScript — mitiga XSS.
- Funcionamento automático com credenciais cross-origin.
- Logout limpa o cookie com `res.clearCookie`.

### Negative

- `maxAge` do cookie (30 dias) é maior que `expiresIn` do JWT (1 dia) — cookie persiste mas token fica inválido. O cliente receberá 401 após 1 dia mesmo com cookie ativo. Requer implementação de refresh token para UX adequada.
- `SameSite: 'none'` requer `Secure: true` — funciona apenas com HTTPS em produção.
- CSRF é mitigado por `SameSite`, mas deve ser reavaliado se os domínios mudarem.

## Risks and mitigations

| Risco | Mitigação |
|---|---|
| Assimetria cookie 30d vs JWT 1d | Implementar endpoint de refresh token (pendente) |
| Token vazado no header Authorization | Verificar que clientes usam o cookie, não o header, em produção |
| SameSite='lax' em dev permite envio em navegação top-level cross-site | Aceitável em desenvolvimento local; não exposto em produção |

## Validation

- Login retorna cookie com `httpOnly` e `secure` no cabeçalho `Set-Cookie`.
- Request com cookie expirado retorna HTTP 401.
- Request sem cookie e sem Authorization header retorna HTTP 401.
- Logout limpa o cookie no response.

## Supersedes

Nenhum.

## Superseded by

Nenhum.
