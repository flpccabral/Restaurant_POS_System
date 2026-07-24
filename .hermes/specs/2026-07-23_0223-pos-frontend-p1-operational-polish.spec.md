# POS Frontend P1 — Polimento operacional premium

## Meta
- **Objetivo:** Evoluir o `pos-frontend` de P0 responsivo para PDV operacional premium, sem criar novas features pesadas.
- **Tipo:** frontend / visual polish / UX operacional.
- **Projeto alvo:** `pos-frontend` somente.
- **Arquivos alvo prováveis:**
  - `src/pages/Home.jsx`, `src/components/home/Greetings.jsx`, `src/components/home/MiniCard.jsx`
  - `src/pages/Menu.jsx`, `src/components/menu/MenuContainer.jsx`, `src/components/menu/CartInfo.jsx`, `src/components/menu/Bill.jsx`
  - `src/components/shared/Header.jsx`, `src/components/pdv/PdvFooterActions.jsx`
  - `src/components/kds/KitchenDisplay.jsx`
  - `src/pages/Dashboard.jsx`, `src/pages/Orders.jsx` apenas microcopy/limite visual se necessário

## Contexto
- P0 aprovado: build passou, overflow mobile zerado em `/`, `/menu`, `/orders`, `/tables`, `/dashboard`, `/kitchen`.
- Design review P1: nota atual 5,5/10 como PDV premium; gap principal é visual genérico, Home vazia, Menu colorido/saturado, microcopy fraca e Dashboard com cara de admin.
- `pos-frontend` é app operacional: venda, comanda, mesa, caixa, impressão, KDS.
- Administração/configuração/reporting avançado pertence ao `pos-admin`.

## Restrições
- Não alterar backend, `pos-admin`, package.json/package-lock ou dependências.
- Não migrar rotas nem remover funcionalidades existentes.
- Não implementar Delivery/Pré-venda/comissões/relatórios novos.
- Não fazer design system do zero.
- Não resolver campanha global de lint/prop-types; apenas evitar novos erros nos arquivos tocados.
- Não quebrar fluxo: selecionar produto → carrinho → finalizar.

## Entrada visual de referência
- `/tmp/pos-frontend-p0-approved-20260722-224254/menu-desktop.png`
- `/tmp/pos-frontend-p0-approved-20260722-224254/menu-mobile.png`
- `/tmp/pos-frontend-p0-approved-20260722-224254/home-desktop.png`
- `/tmp/pos-frontend-p0-approved-20260722-224254/home-mobile.png`
- `/tmp/pos-frontend-p0-approved-20260722-224254/kitchen-desktop.png`
- `/tmp/pos-frontend-p0-approved-20260722-224254/kitchen-mobile.png`
- `/tmp/pos-frontend-p0-approved-20260722-224254/dashboard-mobile.png`
- `/tmp/pos-frontend-p0-approved-20260722-224254/orders-mobile.png`

## Saída esperada P1
### 1. Home vira cockpit operacional
- [ ] `/` deve deixar de parecer tela vazia.
- [ ] Exibir saudação + relógio + status operacional do turno/caixa se houver dado; se não houver, usar estado visual honesto sem placeholder falso.
- [ ] Adicionar ações rápidas operacionais: Nova Comanda, Mesas, Caixa, Imprimir Último Cupom.
- [ ] Exibir KPIs leves de turno: vendas do turno/dia, comandas abertas, mesas ocupadas, itens em preparo.
- [ ] Exibir resumo das últimas 3–5 comandas/pedidos com status e total quando houver dados.
- [ ] Remover “0% do que ontem” se não houver dado real de tendência.

### 2. PDV/Menu polish
- [ ] Reduzir caos cromático: categorias devem usar chips/cartões mais neutros com um destaque ativo claro; evitar múltiplas cores saturadas simultâneas.
- [ ] Mobile: categorias preferencialmente em carrossel horizontal de chips, não grade 4 colunas pesada.
- [ ] Produto card deve ter hierarquia clara: nome, variação, preço, quantidade e ação principal.
- [ ] Ação principal deve ser mais óbvia que ícone solto; botões de quantidade devem manter touch target confortável.
- [ ] Área de produto mobile deve manter respiro inferior para o botão Carrinho não cobrir último item.
- [ ] Carrinho/empty states com copy acionável e ícone consistente, sem emojis como elemento operacional principal.

### 3. Header/footer operacional
- [ ] Header: tooltip/semântica do ícone de grid deve virar “Resumo do Turno” se mantido.
- [ ] Evitar duplicidade visual de logout: se header e footer ambos mantiverem sair, reduzir destaque de um deles.
- [ ] Footer: remover da barra principal botões desabilitados “Em breve” no desktop se poluírem; mobile já não mostra Pré-venda/Delivery.
- [ ] Corrigir active state de “Caixa”: não deve parecer ativo só porque está em `/menu`; deve abrir modal/estado próprio sem marcar indevidamente a rota.

### 4. KDS polish
- [ ] Manter tema escuro.
- [ ] Empty state sem emoji grande; usar ícone de biblioteca já instalada (`react-icons`) ou composição visual simples.
- [ ] Corrigir microcopy: “aparecerao” → “aparecerão”, “estacao” → “estação” em comentário/label se visível.
- [ ] Header/contador continuam sem overflow mobile.

### 5. Dashboard como Resumo do Turno
- [ ] Visualmente renomear/posicionar `/dashboard` como “Resumo do Turno”, não admin completo.
- [ ] Remover ou reduzir destaque das ações “Adicionar Mesa/Categoria/Pratos” na tela operacional; se mantidas por compatibilidade, colocá-las em área secundária discreta.
- [ ] Não evoluir Comissões/Fluxo de Caixa analítico como admin premium neste P1.

### 6. Microcopy PT-BR nas telas tocadas
- [ ] Corrigir: Ofereca→Ofereça, servico→serviço, Marco→Março, Balcao→Balcão, aparecerao→aparecerão.
- [ ] Corrigir datas visíveis em pedidos de inglês/AM-PM para formato PT-BR quando estiver no arquivo tocado.
- [ ] Substituir `item(ns)`/`produto(s)` por pluralização simples quando possível, sem criar helper global pesado.
- [ ] Corrigir `&middot;` renderizado literalmente quando aparecer visualmente.

## Critérios de verificação
- [ ] `cd pos-frontend && npm run build` passa.
- [ ] ESLint nos arquivos tocados deve ter 0 erros novos; se `KitchenDisplay.jsx` prop-types preexistentes aparecerem, documentar e não mascarar.
- [ ] Capturas finais desktop/mobile de `/`, `/menu`, `/dashboard`, `/kitchen`, `/orders`.
- [ ] Mobile 390×844: root overflow e elementos úteis fora da viewport devem ser 0 em `/`, `/menu`, `/orders`, `/tables`, `/dashboard`, `/kitchen`.
- [ ] Verificação visual: fluxo de venda, carrinho, footer/header, dashboard e KDS sem regressão bloqueante.
- [ ] Confirmar que backend, `pos-admin` e package files não foram alterados.

## Notas para Builder
- Preserve a arquitetura P0: Menu desktop 2 painéis; mobile com bottom sheet do carrinho.
- Prefira mudanças visuais localizadas com Tailwind existente.
- Não use emojis como principal elemento operacional novo; `react-icons` já está disponível.
- Se uma recomendação do design review exigir muita lógica nova, deixe para P2.

## Resultado
- **Status:** aprovado como P1 completo após Etapa 2 cirúrgica.
- **Build:** `cd pos-frontend && npm run build` passou (`✓ built in 1.38s`).
- **Lint:** arquivos alterados no P1 parcial passaram com 0 erros/0 warnings: `src/utils/index.js`, `Greetings.jsx`, `MiniCard.jsx`, `Home.jsx`, `MenuContainer.jsx`, `CartInfo.jsx`, `Bill.jsx`.
- **Screenshots:** `/tmp/pos-frontend-p1-partial-20260722-233235/`.
- **Overflow mobile:** root overflow 0 em `/`, `/menu`, `/orders`, `/tables`, `/dashboard`, `/kitchen`; `/menu` ainda tem chips de categoria dentro de carrossel horizontal, esperado visualmente para P1 parcial.
- **Divergências:** Etapa 1 foi parcial, mas a Etapa 2 fechou Header/Footer, KDS empty state/microcopy e Dashboard como “Resumo do Turno”. `KitchenDisplay.jsx` mantém apenas dívida preexistente de `react/prop-types` em `OrderCard`.
- **Próximos passos:** considerar campanha separada para lint/prop-types do KDS e P2 para migração/limpeza mais profunda de responsabilidades admin para `pos-admin`.
