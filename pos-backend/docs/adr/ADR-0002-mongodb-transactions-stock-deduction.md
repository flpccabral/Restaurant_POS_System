# ADR-0002: Baixa de Estoque com MongoDB Sessions (Transações ACID)

- Status: Accepted
- Date: 2026-06-01 (reconstituído — ver services/orderCheckoutService.js, Fase 9.1C)
- Decision owners: Arquiteto backend
- Related components: `services/orderCheckoutService.js`, `services/stockReversalService.js`, `services/transferService.js`, `controllers/pdvController.js`, `controllers/orderController.js`

## Context

A baixa de estoque durante o checkout de pedidos envolve múltiplas escritas atômicas: deduzir saldo de ingredientes, criar registros de `StockMovement`, calcular COGS e atualizar o `Order`. Se qualquer passo falhar parcialmente, o banco ficará em estado inconsistente.

## Decision

Usar MongoDB Sessions com `startTransaction()` / `commitTransaction()` / `abortTransaction()` para garantir atomicidade (All-or-Nothing) em todas as operações de estoque.

A política de erros é bifurcada:
- **Hard errors**: falha crítica (estoque insuficiente, receita não encontrada em modo estrito, localização da loja ausente) — lança exceção, aborta transação.
- **Soft errors**: condição não bloqueadora (produto sem receita, variação não mapeada) — registra no resultado mas não aborta o checkout; o pedido prossegue com flag de aviso.

A session MongoDB é criada no controller e passada para `processOrderStockDeduction` — nunca criada internamente no service. Isso permite que o controller decida o escopo da transação.

## Alternatives considered

1. **Operações sem transação com compensação manual** — descartado por complexidade de implementação de rollback e risco de estados inconsistentes.
2. **Fila de mensagens (Bull/Redis)** — descartado por adicionar infraestrutura sem necessidade comprovada no estágio atual.
3. **Transação encapsulada no service** — descartado pois impede que o controller componha operações de domínios diferentes na mesma transação (ex: criar Payment + deduzir estoque no mesmo commit).

## Consequences

### Positive

- Garantia ACID para operações financeiras críticas.
- Rollback automático em caso de falha parcial.
- COGS calculado e armazenado no pedido para analytics posteriores.
- Política clara de soft vs hard error documentada no código.

### Negative

- Exige MongoDB em modo Replica Set (ou Atlas M10+). Cluster standalone não suporta transações.
- Sessions aumentam latência por round-trips adicionais ao banco.
- Complexidade de passar `session` por parâmetro em toda a cadeia de chamadas.

## Risks and mitigations

| Risco | Mitigação |
|---|---|
| MongoDB sem Replica Set em ambiente de desenvolvimento | Usar `mongodb-memory-server` (já configurado no jest.config.js) ou Atlas M0 (grátis, RS habilitado) |
| Session não fechada em caso de erro não capturado | `try/catch/finally` com `session.endSession()` em todos os pontos de entrada |
| Deadlock entre transações concorrentes | MongoDB tem timeout de lock; o retry é responsabilidade do chamador |

## Validation

- Teste: checkout com saldo suficiente → StockMovement criado + Order com COGS preenchido.
- Teste: checkout com saldo insuficiente → abortTransaction + Order não atualizado.
- Teste: falha de banco no meio da transação → nenhuma escrita persistida.

## Supersedes

Nenhum.

## Superseded by

Nenhum.
