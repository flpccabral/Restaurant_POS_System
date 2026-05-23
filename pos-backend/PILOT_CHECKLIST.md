# Checklist de Validacao para Piloto -- Restaurant POS

## 1. Autenticacao e Acesso
- [ ] Login com credenciais validas funciona
- [ ] Login com credenciais invalidas retorna erro
- [ ] Logout funciona e limpa a sessao
- [ ] Token expirado redireciona para tela de login
- [ ] Acesso ao console requer autenticacao

## 2. Permissoes (Phase 8)
- [ ] Master Admin ve todas as abas e botoes
- [ ] Usuario com inventory:read ve dados mas nao botoes de acao
- [ ] Usuario com inventory:adjust ve botoes Resolver/Ignorar/Politicas
- [ ] Usuario com inventory:transfer ve botoes de transferencia
- [ ] Usuario sem inventory:read ve apenas mensagem "Sem permissao"

## 3. Visao Geral
- [ ] Carregamento mostra LoadingState
- [ ] Dados carregados mostram metricas corretas
- [ ] Erro de carregamento mostra ErrorState com botao Retry
- [ ] Loja sem dados mostra EmptyState

## 4. Saude do Estoque
- [ ] Tabela lista todos os ingredientes com status
- [ ] Cores dos badges correspondem ao status
- [ ] Filtros de status funcionam
- [ ] Busca por nome funciona
- [ ] Paginacao ou scroll para muitos ingredientes

## 5. Alertas
- [ ] Lista alertas com severity badge
- [ ] Filtros de status (Novos/Resolvidos/Ignorados) funcionam
- [ ] Filtros de severidade funcionam
- [ ] Resolver alerta abre modal de confirmacao
- [ ] Confirmar resolucao executa e mostra snackbar
- [ ] Ignorar alerta abre modal de confirmacao
- [ ] Double-click protection: botao desabilitado durante execucao
- [ ] Alerta resolvido/ignorado some da lista apos refresh
- [ ] Sem permissao (inventory:adjust): botoes nao aparecem

## 6. Recomendacoes
- [ ] Lista recomendacoes com tipo e prioridade
- [ ] Filtros de prioridade funcionam
- [ ] Filtros de tipo (Central/Lojas/Compra) funcionam
- [ ] Executar transferencia abre modal com detalhes
- [ ] Registrar compra abre modal com detalhes
- [ ] Confirmar executa e mostra snackbar
- [ ] Sem permissao (inventory:transfer): botoes nao aparecem
- [ ] Sem permissao (inventory:adjust): Registrar Compra nao aparece

## 7. Timeline
- [ ] Lista eventos em ordem cronologica decrescente
- [ ] Movimentacoes, producoes e alertas aparecem
- [ ] Filtros funcionam (data, ingrediente)

## 8. Politicas de Estoque
- [ ] Tabela lista politicas com todos os campos
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
- [ ] Resolver alerta registra log de auditoria
- [ ] Ignorar alerta registra log de auditoria
- [ ] Transferencia registra log de auditoria
- [ ] Compra registra log de auditoria
- [ ] Criar politica registra log de auditoria
- [ ] Atualizar politica registra log de auditoria
- [ ] Desativar politica registra log de auditoria
- [ ] Log contem: usuario, acao, loja, timestamp, resumo
- [ ] Falha de auditoria nao quebra a operacao

## 10. Performance e Estabilidade
- [ ] Consumo de dados paginado (limite por query)
- [ ] StaleTime configurado para evitar refetch excessivo
- [ ] Erros de rede mostram feedback claro
- [ ] Console nao trava com muitos ingredientes
- [ ] WebSocket reconecta apos queda de conexao

## 11. Dados de Producao
- [ ] Ingredientes possuem politicas de estoque configuradas
- [ ] Consumo historico (24h/7d) disponivel
- [ ] Alertas sendo gerados automaticamente
- [ ] Recomendacoes sendo geradas pela rede
- [ ] Transferencias registram movimentacao de estoque

## 12. Piloto (Go/No-Go)
- [ ] Todos os itens acima verificados
- [ ] Testes de integracao (Phase 6) passam (78/78)
- [ ] Build do frontend sem erros
- [ ] Checklist assinado pelo responsavel
