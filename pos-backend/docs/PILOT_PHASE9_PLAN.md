# Plano do Piloto Controlado — Fase 9

> Documento gerado em: 2026-05-24
> Loja piloto: Loja Demo - Matriz (`6a1101372ff5c713c1b1a147`)

---

## 1. Objetivo do Piloto

Validar o sistema Restaurant POS em ambiente controlado com operações reais supervisionadas, fluxo completo Produto → Receita → Venda → Baixa de Estoque → CMV → Alertas, antes da liberação para uso amplo.

Escopo: **1 loja, 3 perfis de usuário, operações supervisionadas**.

## 2. Loja Piloto

| Campo | Valor |
|-------|-------|
| Nome | Loja Demo - Matriz |
| ID | `6a1101372ff5c713c1b1a147` |
| CNPJ | 00.000.000/0001-00 |
| Tipo | geral |
| Produtos ativos | 6 |
| Receitas ativas | 4 |
| Localização estoque | 1 ("Estoque - Loja Demo - Matriz") |

## 3. Usuários do Piloto

| Nome | Email | Perfil | Acesso Console | Acesso PDV | Ajusta Estoque |
|------|-------|--------|---------------|------------|----------------|
| Admin Master | admin@pos.com | Master Admin | Sim | Sim | Sim |
| Gerente Demo | gerente.demo@pos.com | Gerente Filial | Sim | Sim | Sim |
| Operador Demo | operador.demo@pos.com | Operador | Não | Sim | Não |

## 4. Ambiente

- **Backend**: Node.js + Express + MongoDB (localhost ou Atlas)
- **pos-admin**: Next.js 16 (dashboard administrativo e console)
- **pos-frontend**: Vite + React (PDV / ponto de venda)

## 5. Pré-requisitos Técnicos

- [x] Backend online e tests passando (19/19)
- [x] pos-admin build OK
- [x] pos-frontend build OK
- [ ] Sincronizar `hasActiveRecipe` nos produtos com receita (bug identificado)
- [ ] Ativar política de estoque da Carne Bovina
- [ ] Criar políticas para ingredientes das receitas: Pão, Queijo Mussarela, Alface, Tomate, Farinha de Trigo, Azeite de Oliva
- [ ] Limpar/resolver 5 alertas operacionais pendentes
- [ ] Verificar saldos de estoque e ajustar se necessário
- [ ] Confirmar device approval funcional

## 6. Checklist Diário do Piloto

- [ ] Verificar Console — alertas críticos novos
- [ ] Verificar saúde do estoque (StockHealthTab)
- [ ] Confirmar vendas do dia geraram baixa de estoque
- [ ] Revisar CMV do dia
- [ ] Verificar timeline de movimentações
- [ ] Resolver alertas pendentes

## 7. Métricas de Sucesso

| Métrica | Meta |
|---------|------|
| % vendas com baixa de estoque concluída | ≥ 95% |
| Nº vendas sem receita | 0 |
| Alertas críticos/dia | ≤ 1 |
| Tempo para resolver alerta crítico | ≤ 2h |
| Produtos ativos sem ficha técnica | 0 |
| Ingredientes críticos sem custo | 0 |
| Políticas de estoque configuradas | ≥ 5 |
| Divergência estoque teórico vs contagem | ≤ 5% |

## 8. Critérios de Rollback

- Ponto focal decide parar uso do PDV novo
- Operação reverte para controle manual/legado
- Pedidos do período piloto ficam registrados para auditoria
- Estoque pode ser ajustado via movimentação manual no Console
- Logs de todas as operações são exportáveis

## 9. Critérios de Encerramento

- 7 dias consecutivos sem alertas críticos não resolvidos
- 95%+ vendas com baixa de estoque
- Nenhum produto ativo sem receita
- Validação de inventário manual vs sistema com divergência ≤ 5%

## 10. Decisão Go/No-Go

Ver checklist em anexo no relatório da Fase 9.
