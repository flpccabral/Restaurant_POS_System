---
name: checkpoint_9.3c_completed
description: Fase 9.3C complete — PDV minimo evoluido, PDV_MINIMO_APROVADO_PARA_9_4
metadata:
  type: project
---

# Fase 9.3C — EVOLUCAO MINIMA DO PDV CONCLUIDA

**Decisao final**: PDV_MINIMO_APROVADO_PARA_9_4

## O que foi implementado (9 itens P0)

1. **orderType/serviceMode**: Adicionado orderType (dine_in, counter, pickup, delivery) ao Order model. Dine-in requer mesa, counter/pickup nao.

2. **Separacao de status financeiro de kitchen status**: Adicionado paymentStatus (unpaid/partially_paid/paid/refunded), closeStatus (open/closing/closed), observations (max 500) ao Order model.

3. **Table release rule fix**: KDS markOrderServed nao libera mesa em dine-in. Mesa so e liberada por PDV closing/payment.

4. **Table closing endpoint**: POST /api/table/:id/close — valida mesa, processa pagamento, libera mesa.

5. **Novo pedido em mesa ocupada**: addOrder aceita Booked tables (apenas atualiza currentOrder). TableCard mostra "Novo Pedido" overlay.

6. **Accumulated bill**: GET /api/table/:id/bill — retorna mesa + ordens + totais agregados + paymentStatus.

7. **Counter mode**: Botao "Atendimento Balcao" no Tables, orderType=counter, paymentStatus=paid upfront.

8. **Product search**: Header busca funcional por nome/SKU, navega para /menu?search=<query>.

9. **Item/order observations**: CartInfo com input de notas por item, Bill com observacao geral. Visiveis no KDS.

## Validacoes
- Backend tests: 19/19 passed
- Frontend build: OK (vite)
- Admin/KDS build: OK (Next.js)
- pilot-audit-consistency: 0 divergencias criticas
- pilot-validate-console: PASS
- pilot-snapshot: 9 colecoes exportadas

## Proxima fase
Fase 9.4 — Expansao controlada da janela do piloto
