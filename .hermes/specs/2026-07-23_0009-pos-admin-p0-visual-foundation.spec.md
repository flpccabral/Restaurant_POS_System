# POS Admin P0 — Fundação visual e responsividade

## Meta
- **Objetivo:** Corrigir os problemas P0 do design review do `pos-admin`: tipografia global, responsividade do layout shell, microcopy PT-BR crítica e acessibilidade básica de foco/navegação.
- **Tipo:** frontend / visual foundation / UX fix
- **Projeto alvo:** `pos-admin` (Next.js em `http://localhost:3000`)
- **Arquivo(s) alvo prováveis:**
  - `pos-admin/src/app/globals.css`
  - `pos-admin/src/app/layout.tsx`
  - `pos-admin/src/app/(dashboard)/layout.tsx`
  - `pos-admin/src/components/layout/sidebar.tsx`
  - `pos-admin/src/components/layout/header.tsx`
  - `pos-admin/src/app/(auth)/login/page.tsx`
  - arquivos com microcopy sem acento, somente se forem tocados de forma segura
- **Dependências:** backend local `pos-backend` em `localhost:8000` só é necessário para screenshots autenticadas; build/lint não dependem dele.

## Contexto
- O design review concluiu que o `pos-admin` é funcional, mas genérico e não-premium.
- Problemas P0 identificados:
  - mobile quebrado por sidebar/header desktop-only;
  - tipografia inconsistente/serifada;
  - hierarquia visual fraca;
  - ações/foco e microcopy PT-BR com problemas.
- Screenshots reais de referência:
  - `/tmp/pos-admin-audit/contact-sheet-auth2.png`
  - `/tmp/pos-admin-audit/dashboard-mobile.png`
  - `/tmp/pos-admin-audit/settings-mobile.png`

## Restrições
- Não alterar backend.
- Não alterar `pos-frontend`.
- Não refazer Dashboard/Settings/Products nesta etapa; P0 é fundação visual/layout shell.
- Não trocar biblioteca de UI.
- Não introduzir dependências novas sem necessidade comprovada.
- Não implementar P1/P2 agora.
- Manter a rota `/settings` no `pos-admin`.
- Manter o comportamento de autenticação atual.

## Estado atual observado
- `pos-admin/src/app/globals.css` define `--font-sans: var(--font-sans)`, provável causa da fonte errada.
- `pos-admin/src/app/(dashboard)/layout.tsx` usa shell fixo desktop com `ml-64`.
- `pos-admin/src/components/layout/header.tsx` usa header fixo com `left-64`.
- `pos-admin/src/components/layout/sidebar.tsx` usa sidebar fixa `w-64` sempre visível.
- Mobile atual: sidebar ocupa boa parte da tela, conteúdo espremido e scroll horizontal.
- Login usa copy em inglês e loading com `...`.

## Saída Esperada
- [ ] Tipografia global corrigida para fonte sans-serif moderna já configurada no projeto.
- [ ] Layout autenticado responsivo:
  - desktop: sidebar persistente + header alinhado ao conteúdo;
  - mobile/tablet pequeno: sidebar não pode ocupar espaço fixo; deve virar drawer/overlay ou estado escondido controlável;
  - sem scroll horizontal em 390px de largura.
- [ ] Header responsivo:
  - seletor de loja não pode cortar a tela;
  - usuário/menu deve continuar acessível;
  - navegação mobile deve ter controle claro para abrir/fechar menu.
- [ ] Sidebar responsiva:
  - mantém seções e itens atuais;
  - destaque ativo continua claro;
  - labels principais com acentuação corrigida quando estiverem erradas.
- [ ] Login polido minimamente:
  - copy final em português;
  - reticências tipográficas corretas;
  - sem regressão visual.
- [ ] Microcopy PT-BR crítica corrigida nos arquivos tocados:
  - `Gestao` → `Gestão`
  - `Fichas Tecnicas` → `Fichas Técnicas`
  - `Acoes` → `Ações`
  - `Pagina` → `Página`
  - `Proxima` → `Próxima`
  - `Visao` → `Visão`
  - `Ultimos` → `Últimos`
  - `Tendencia` → `Tendência`
  - `Liquido` → `Líquido`
- [ ] Foco/keyboard básicos preservados ou melhorados.

## Critérios de Verificação
- [ ] `cd pos-admin && npx eslint src/app/globals.css src/app/layout.tsx src/app/'(dashboard)'/layout.tsx src/components/layout/sidebar.tsx src/components/layout/header.tsx src/app/'(auth)'/login/page.tsx` não deve reportar erro nos arquivos tocados. Se ESLint não aceitar CSS como input, rodar lint nos TSX alterados e explicar.
- [ ] `cd pos-admin && npm run build` deve passar.
- [ ] Capturar screenshots reais depois da mudança:
  - login desktop;
  - dashboard desktop autenticado;
  - settings desktop autenticado;
  - dashboard mobile 390px;
  - settings mobile 390px.
- [ ] Verificação visual mínima:
  - mobile 390px não tem sidebar fixa ocupando metade da tela;
  - conteúdo principal começa visível sem scroll horizontal;
  - header não corta seletor de loja de forma grave;
  - fonte não aparece serifada.
- [ ] Não alterar backend nem `pos-frontend`.

## Notas para o Builder
- Siga o design review: evoluir, não reescrever do zero.
- Preferir componentes já existentes no projeto.
- Use tokens semânticos existentes em vez de cores hardcoded.
- Se for necessário estado client-side para abrir/fechar sidebar mobile, manter simples e local ao layout/header/sidebar.
- O resultado deve ser uma fundação para P1; não tente redesenhar KPIs/tabelas/settings profundamente nesta rodada.

## Resultado
- **Status:** pendente
- **Build:** pendente
- **Divergências:** pendente
- **Próximos passos:** após P0 aprovado, iniciar P1 Dashboard/Settings premium.
