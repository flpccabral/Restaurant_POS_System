# Checklist de Validacao para Piloto -- Restaurant POS

## Instrucoes
Marque cada item apos verificacao manual. Use a coluna de observacoes para
registrar evidencias, prints ou numeros relevantes.

- [ ] = nao verificado
- [x] = verificado e OK
- [-] = N/A ou nao se aplica
- [E] = ERRO encontrado (descrever)

---

## 0. Pre-Piloto — Ambiente e Dados

### 0.1 Infraestrutura
- [ ] Backend rodando (porta 8000) — `curl http://localhost:8000/` retorna 200
- [ ] Frontend rodando (porta 5173) — `curl http://localhost:5173/` retorna 200
- [ ] MongoDB conectado — sem erros no console do backend
- [ ] WebSocket ativo — sem erros de conexao no frontend
- [ ] Variaveis de ambiente configuradas (.env)
- [ ] Nenhum segredo/chave hardcoded no codigo

### 0.2 Seed de Dados do Piloto
- [ ] `node scripts/pilot-seed.js` executado sem erros
- [ ] 5 lojas criadas com prefixo PILOT_
- [ ] Ingredientes globais do piloto criados (46+ ingredientes)
- [ ] Localizacoes de estoque criadas (STORE + CENTRAL_WAREHOUSE)
- [ ] Saldos iniciais carregados (estoque por loja + central)
- [ ] Politicas de estoque configuradas (lojas operacionais)
- [ ] Usuarios do piloto criados (admin, viewer, gerentes, operadores)
- [ ] Roles do sistema criadas (Admin, Gerente, Viewer, Operator, Caixa, Gargom)

### 0.3 Documentacao
- [ ] PILOT_GUIDE.md presente e atualizado
- [ ] PILOT_CHECKLIST.md presente e preenchido
- [ ] PILOT_PERMISSION_MATRIX.md presente
- [ ] PILOT_ROLLBACK_PLAN.md presente
- [ ] PILOT_ROADMAP.md presente
- [ ] PILOT_METRICS.md presente
- [ ] Endpoint GET /api/audit/daily-report disponivel

---

## 1. Autenticacao e Acesso
- [ ] Login com credenciais validas funciona
- [ ] Login com credenciais invalidas retorna erro 401
- [ ] Logout funciona e limpa a sessao
- [ ] Token expirado redireciona para tela de login
- [ ] Acesso ao console requer autenticacao (redireciona se nao logado)
- [ ] Login com cada perfil do piloto funciona (admin, gerente, operator, viewer)

## 2. Permissoes (Phase 8)
- [ ] Master Admin ve todas as abas e botoes
- [ ] Usuario com inventory:read (Viewer) ve dados mas nao botoes de acao
- [ ] Usuario com inventory:adjust (Operator) ve botoes Resolver/Ignorar/Politicas
- [ ] Usuario com inventory:transfer (Operator/Gerente) ve botoes de transferencia
- [ ] Usuario sem inventory:read ve apenas mensagem "Sem permissao"

## 3. Visao Geral (Overview)
- [ ] Carregamento mostra LoadingState
- [ ] Dados carregados mostram metricas corretas
- [ ] Erro de carregamento mostra ErrorState com botao Retry
- [ ] Loja sem dados mostra EmptyState

## 4. Saude do Estoque
- [ ] Tabela lista todos os ingredientes com status
- [ ] Cores dos badges correspondem ao status (vermelho=stockout, laranja=critical, etc.)
- [ ] Filtros de status funcionam (Ruptura, Critico, Baixo, Normal, Excesso, Sem Politica)
- [ ] Busca por nome funciona
- [ ] Paginacao ou scroll para muitos ingredientes

## 5. Alertas
- [ ] Lista alertas com severity badge (info, low, medium, high, critical)
- [ ] Filtros de status (Novos/Resolvidos/Ignorados) funcionam
- [ ] Filtros de severidade funcionam
- [ ] Resolver alerta abre modal de confirmacao
- [ ] Confirmar resolucao executa e mostra snackbar de sucesso
- [ ] Ignorar alerta abre modal de confirmacao
- [ ] Double-click protection: botao desabilitado durante execucao
- [ ] Alerta resolvido/ignorado some da lista apos refresh
- [ ] Sem permissao (inventory:adjust): botoes nao aparecem

## 6. Recomendacoes
- [ ] Lista recomendacoes com tipo e prioridade
- [ ] Filtros de prioridade funcionam
- [ ] Filtros de tipo (Central/Lojas/Compra) funcionam
- [ ] Executar transferencia abre modal com detalhes (origem, destino, quantidade)
- [ ] Registrar compra abre modal com detalhes
- [ ] Confirmar executa e mostra snackbar
- [ ] Sem permissao (inventory:transfer): botoes nao aparecem
- [ ] Sem permissao (inventory:adjust): Registrar Compra nao aparece

## 7. Timeline
- [ ] Lista eventos em ordem cronologica decrescente
- [ ] Movimentacoes, producoes e alertas aparecem
- [ ] Filtros funcionam (data, ingrediente)

## 8. Politicas de Estoque
- [ ] Tabela lista politicas com todos os campos (ingrediente, min, reorder, ideal, max, prioridade)
- [ ] Filtros de prioridade funcionam
- [ ] Filtros de ativo/inativo funcionam
- [ ] Busca por ingrediente funciona
- [ ] Criar politica abre formulario com validacao
- [ ] Validacao hierarquica (min <= reorder <= ideal <= max)
- [ ] Campos obrigatorios sao validados
- [ ] Editar politica abre formulario pre-preenchido
- [ ] Desativar politica mostra confirmacao
- [ ] Loading state durante submit do formulario
- [ ] Sem permissao (inventory:adjust): botoes nao aparecem

## 9. Auditoria (Phase 8)
- [ ] Resolver alerta registra log de auditoria (actionType: alert_resolved)
- [ ] Ignorar alerta registra log de auditoria (actionType: alert_dismissed)
- [ ] Transferencia central->loja registra log de auditoria
- [ ] Transferencia loja->loja registra log de auditoria
- [ ] Compra registra log de auditoria (actionType: purchase_registered)
- [ ] Criar politica registra log de auditoria (actionType: stock_policy_created)
- [ ] Atualizar politica registra log de auditoria (actionType: stock_policy_updated)
- [ ] Desativar politica registra log de auditoria (actionType: stock_policy_deleted)
- [ ] Log contem: usuario, acao, loja, timestamp, resumo
- [ ] Falha de auditoria nao quebra a operacao
- [ ] GET /api/audit/daily-report retorna JSON valido com acoes do dia

## 10. Performance e Estabilidade
- [ ] Consumo de dados paginado (limite por query)
- [ ] StaleTime configurado para evitar refetch excessivo
- [ ] Erros de rede mostram feedback claro
- [ ] Console nao trava com muitos ingredientes
- [ ] WebSocket reconecta apos queda de conexao

## 11. Dados de Producao
- [ ] Ingredientes possuem politicas de estoque configuradas
- [ ] Consumo historico (24h/7d) disponivel
- [ ] Alertas sendo gerados automaticamente (quando aplicavel)
- [ ] Recomendacoes sendo geradas pela rede
- [ ] Transferencias registram movimentacao de estoque

## 12. Documentacao do Piloto — Verificacao Final
- [ ] PILOT_GUIDE.md: instrucoes claras para uso do console
- [ ] PILOT_CHECKLIST.md: todos os itens acima verificados
- [ ] PILOT_PERMISSION_MATRIX.md: matriz reflete as roles no banco
- [ ] PILOT_ROLLBACK_PLAN.md: acoes de rollback viaveis tecnicamente
- [ ] PILOT_ROADMAP.md: quem, como, quando, o que fazer
- [ ] PILOT_METRICS.md: metricas extraiveis dos endpoints existentes

## 13. Testes Automatizados
- [ ] Testes Phase 6 passam: `cd pos-backend && node scripts/test-phase6.js`
- [ ] Frontend compila sem erros: `cd pos-frontend && npx vite build`

## 14. Decisao Final (Go / No-Go)
- [ ] Todos os itens criticos acima verificados
- [ ] Nenhum erro bloqueador conhecido
- [ ] Equipe ciente das responsabilidades
- [ ] Plano de rollback disponivel
- [ ] Canais de comunicacao estabelecidos

> **Decisao:** [ Go / No-Go / Go com ressalvas ]
> **Responsavel:** ________________________
> **Data:** ____/____/______
> **Assinatura:** ________________________
