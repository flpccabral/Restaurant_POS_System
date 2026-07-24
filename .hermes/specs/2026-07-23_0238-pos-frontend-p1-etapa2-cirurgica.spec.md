# POS Frontend P1 Etapa 2 — Fechamento cirúrgico

## Meta
- **Objetivo:** Fechar os itens P1 pendentes sem mexer no que já foi validado na Etapa 1 parcial.
- **Tipo:** frontend / visual polish / microcopy / responsabilidade operacional.
- **Projeto alvo:** `pos-frontend` somente.
- **Arquivos alvo permitidos:**
  - `src/components/shared/Header.jsx`
  - `src/components/pdv/PdvFooterActions.jsx`
  - `src/components/kds/KitchenDisplay.jsx`
  - `src/pages/Dashboard.jsx`
  - opcionalmente `src/components/dashboard/Metrics.jsx` apenas se necessário para título/microcopy do Resumo do Turno.

## Contexto
- P1 Etapa 1 ficou parcial, validada em build/lint/screenshots/overflow.
- Home cockpit e Menu/PDV polish já foram aceitos como parciais; não mexer neles.
- Pendências visíveis:
  - Header ainda usa tooltip `Dashboard` para o ícone de grid.
  - Footer desktop ainda mostra `Pré-venda` e `Delivery` desabilitados/“Em breve”.
  - Footer marca `Caixa` como ativo quando a rota é `/menu`, mesmo sem modal de caixa aberto.
  - KDS empty state ainda usa emoji `✅` grande e texto `Os pedidos aparecerao aqui automaticamente`.
  - Dashboard ainda tem `document.title = 'POS | Painel Admin'`, botões `Adicionar Mesa/Categoria/Pratos`, e não se apresenta como `Resumo do Turno`.

## Restrições
- Não alterar backend, `pos-admin`, package.json/package-lock, dependências ou rotas.
- Não tocar Home/Menu/CartInfo/Bill/MiniCard/Greetings já validados, salvo se o build exigir e com justificativa.
- Não implementar features novas.
- Não remover componentes importados se ainda usados.
- Não resolver campanha global de `prop-types` em `KitchenDisplay.jsx`; apenas evitar novos erros.
- Preservar funcionalidade: logout, impressão, modal de caixa, navegação para comandas/mesas, abas existentes do Dashboard.

## Saída esperada
### 1. Header operacional
- [ ] Tooltip/title do botão de grid deve ser `Resumo do Turno`.
- [ ] Comentário/microcopy visível deve deixar de tratar `/dashboard` como admin.
- [ ] Header não deve ganhar overflow mobile.
- [ ] Se houver logout no header e footer, reduzir destaque visual do header ou manter ambos sem duplicidade agressiva; não remover logout funcional.

### 2. Footer operacional
- [ ] Desktop não deve exibir `Pré-venda` e `Delivery` desabilitados na barra principal.
- [ ] Mobile continua mostrando apenas ações operacionais úteis.
- [ ] `Caixa` não deve usar `active: isActive('/menu')`; deve ficar ativo apenas quando o modal de caixa estiver aberto ou não ficar ativo.
- [ ] Labels/touch targets devem continuar legíveis.

### 3. KDS polish
- [ ] Empty state sem emoji grande operacional; usar `react-icons` já disponível ou composição visual sem emoji.
- [ ] Corrigir texto para `Os pedidos aparecerão aqui automaticamente` ou frase equivalente.
- [ ] Comentário `Filtro de estacao` pode ser corrigido para `Filtro de estação`.
- [ ] Header/contador continuam responsivos sem controle fora da viewport.

### 4. Dashboard como Resumo do Turno
- [ ] `document.title` deve virar `POS | Resumo do Turno`.
- [ ] Tela deve ter título visível `Resumo do Turno` e subtítulo operacional.
- [ ] Botões `Adicionar Mesa`, `Adicionar Categoria`, `Adicionar Pratos` não devem aparecer como ações principais no topo. Opção aceitável: mover para seção secundária discreta `Configurações administrativas` com texto indicando que a gestão completa fica no `pos-admin`; ou esconder/remover do destaque preservando modal de mesa se necessário.
- [ ] Tabs existentes podem permanecer por compatibilidade, mas devem parecer secundárias; não expandir relatório/admin.
- [ ] `Fluxo de Caixa` pode permanecer porque é operação do turno.

## Critérios de verificação do builder
- [ ] `cd pos-frontend && npm run build` passa.
- [ ] Rodar ESLint nos arquivos tocados. Se `KitchenDisplay.jsx` falhar apenas por `react/prop-types` preexistentes, documentar; não corrigir todos prop-types.
- [ ] Não alterar backend, `pos-admin` nem package files.
- [ ] Entregar arquivos alterados e divergências.

## Critérios de verificação Hermes após retorno
- [ ] Diff limitado ao escopo.
- [ ] Build passa.
- [ ] Lint dos arquivos tocados sem erros novos.
- [ ] Screenshots finais de `/dashboard`, `/kitchen`, `/`, `/menu` desktop/mobile.
- [ ] Mobile 390×844: root overflow 0 e sem controles úteis fora da viewport em `/`, `/menu`, `/orders`, `/tables`, `/dashboard`, `/kitchen`.
- [ ] Atualizar `graphify update .` após aprovação.

## Resultado
- **Status:** aprovado após validação independente.
- **Build:** `cd pos-frontend && npm run build` passou (`✓ built in 1.38s`).
- **Lint:** `Header.jsx`, `PdvFooterActions.jsx`, `Dashboard.jsx` passaram com 0 erros; `KitchenDisplay.jsx` mantém 33 erros `react/prop-types` preexistentes em `OrderCard`, sem novos erros de escopo.
- **Screenshots finais:** `/tmp/pos-frontend-p1-etapa2-final-20260722-234209/`.
- **Overflow mobile:** root overflow 0 em `/`, `/menu`, `/orders`, `/tables`, `/dashboard`, `/kitchen`; `/menu` mantém chips de categoria em carrossel horizontal intencional.
- **Divergências:** nenhuma bloqueante. Tabs administrativas do dashboard permanecem por compatibilidade, mas a tela agora se apresenta como `Resumo do Turno`; `Adicionar Mesa` ficou como ação secundária discreta.
- **Próximos passos:** atualizar graphify e considerar campanha separada para `KitchenDisplay.jsx` prop-types se desejado.
