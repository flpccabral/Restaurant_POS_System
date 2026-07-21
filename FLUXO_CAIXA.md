# FLUXO DE CAIXA — ABERTURA, MOVIMENTAÇÃO E FECHAMENTO

## VISÃO GERAL

O caixa é o coração financeiro do restaurante. No Brasil, o fluxo é regulado por práticas contábeis e fiscais que exigem rastreabilidade completa: cada centavo que entra e sai precisa ter origem, destino e operador responsável. Este documento descreve o fluxo real, do início ao fim do expediente.

```
LINHA DO TEMPO DO CAIXA (EXPEDIENTE TÍPICO)

  ABERTURA      ↓ VENDAS ↓          SANGRIA/SUPRIMENTO         ↓ FECHAMENTO
  ────────    ─────────────────    ──────────────────────    ────────────
  08:00       08:00-12:00          10:30 (sangria R$200)    22:00
  R$200       Venda 1: R$45,00     14:00 (suprimento R$50)   Contagem
  inicial     Venda 2: R$120,00    ...                       R$1.847,32
              ...
```

---

## 1. ABERTURA DE CAIXA

### 1.1 Quando e quem abre

- **Momento:** primeiro operador ao iniciar o expediente
- **Quem:** cargo Caixa ou Administrador (Garçom não abre caixa)
- **Restrição:** apenas UM caixa aberto por loja por vez

### 1.2 Fluxo de abertura

```
                    ┌──────────────────┐
                    │  OPERADOR FAZ    │
                    │  LOGIN           │
                    └────────┬─────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │  VERIFICAR: existe caixa     │
              │  aberto para esta loja?      │
              └─────────────┬────────────────┘
                            │
              ┌─────────────┴──────────────┐
              │                            │
           SIM ┌▼──────────────────────┐   │ NÃO
              │  REDIRECIONAR PARA    │   │
              │  OPERAÇÃO NORMAL      │   ▼
              └───────────────────────┘   ┌──────────────────────────┐
                                          │  EXIBIR MODAL:           │
                                          │  "Abrir Caixa"           │
                                          │                          │
                                          │  • Operador: [nome]      │
                                          │  • Data/Hora: automático │
                                          │  • Saldo inicial: [R$__] │
                                          │  • Observação: [opc.]    │
                                          │                          │
                                          │  ┌─Confirmar─┐ ┌Cancelar┐│
                                          └──────────────────────────┘
                                                   │
                                                   ▼
                              ┌────────────────────────────────────┐
                              │  Criar CashRegister no backend:    │
                              │  • status: 'open'                  │
                              │  • openedAt: now                   │
                              │  • initialBalance: R$ 200,00       │
                              │  • operatorId: user._id            │
                              └────────────────────────────────────┘
```

### 1.3 Modelo de dados

```javascript
// Schema: CashRegister
{
  _id: ObjectId,
  storeId: { type: ObjectId, ref: 'Store', required: true },
  operatorId: { type: ObjectId, ref: 'User', required: true },
  openedAt: { type: Date, required: true },
  closedAt: { type: Date },
  initialBalance: { type: Number, required: true, default: 0 },
  // Valor em dinheiro vivo no início do dia
  // Pode ser R$ 0,00 (caixa "zerado") ou R$ 200,00 (troco inicial)

  status: { type: String, enum: ['open', 'closed'], default: 'open' },

  // Lançamentos do dia
  transactions: [{
    type: {
      type: String,
      enum: [
        'opening',        // Abertura (saldo inicial)
        'closing',        // Fechamento (conferência)
        'sale_cash',      // Venda em dinheiro
        'sale_pix',       // Venda em PIX
        'sale_credit',    // Venda em crédito
        'sale_debit',     // Venda em débito
        'sale_voucher',   // Venda em voucher
        'sangria',        // Retirada de dinheiro do caixa
        'supply',         // Reforço de dinheiro no caixa
        'adjustment',     // Ajuste manual (supervisor)
      ]
    },
    value: { type: Number, required: true },       // Valor monetário
    paymentMethod: { type: String },                // Para vendas
    orderId: { type: ObjectId, ref: 'Order' },     // Para vendas
    description: { type: String },                  // Motivo/observação
    operatorId: { type: ObjectId, ref: 'User' },   // Quem lançou
    createdAt: { type: Date, default: Date.now }
  }],

  // Totais calculados (para fechamento)
  totals: {
    cash: { type: Number, default: 0 },       // Soma vendas dinheiro
    pix: { type: Number, default: 0 },         // Soma vendas PIX
    credit: { type: Number, default: 0 },      // Soma vendas crédito
    debit: { type: Number, default: 0 },       // Soma vendas débito
    voucher: { type: Number, default: 0 },     // Soma vendas voucher
    sangrias: { type: Number, default: 0 },    // Soma sangrias
    supplies: { type: Number, default: 0 },    // Soma suprimentos
  },

  // Resumo do fechamento (preenchido no ato)
  closingSummary: {
    expectedCash: { type: Number },    // initialBalance + cash - sangrias + supplies
    actualCash: { type: Number },      // Valor contado pelo operador
    difference: { type: Number },      // actualCash - expectedCash (pode ser negativo)
    differenceReason: { type: String },// Se diff > R$ 50, justificativa obrigatória
    confirmedBy: { type: ObjectId, ref: 'User' }, // Supervisor que aprovou
    confirmedAt: { type: Date },
    notes: { type: String }
  }
}
```

### 1.4 Regras de abertura

| Regra | Comportamento |
|-------|--------------|
| Caixa já aberto | Bloquear abertura, redirecionar para operação normal |
| Sem loja vinculada | Bloquear (operador sem loja não abre caixa) |
| Saldo inicial negativo | Bloquear (não faz sentido) |
| Saldo inicial zerado | Permitir (troco separado da gaveta) |
| Abertura retroativa | Bloquear (data/hora = server, não do cliente) |

---

## 2. MOVIMENTAÇÕES DURANTE O EXPEDIENTE

### 2.1 Tipos de movimentação

```
                                ┌──────────────────────────────────────┐
                                │         MOVIMENTAÇÕES               │
                                │                                      │
                                │  ENTRADAS              SAÍDAS       │
                                │  ──────────            ─────────    │
                                │  • Venda Dinheiro      • Sangria    │
                                │  • Venda Pix           • Ajuste (-) │
                                │  • Venda Débito                       │
                                │  • Venda Crédito       CONTROLE     │
                                │  • Venda Voucher       ─────────    │
                                │  • Suprimento          • Ajuste (+) │
                                │  • Ajuste (+)                       │
                                └──────────────────────────────────────┘
```

### 2.2 Registro automático (vendas)

Toda venda finalizada registra automaticamente uma transação no caixa aberto:

| Método de pagamento | Tipo de transação | Impacto caixa (dinheiro físico) |
|--------------------|-------------------|----------------------------------|
| Dinheiro | `sale_cash` | ✅ Dinheiro entra na gaveta |
| Pix | `sale_pix` | ❌ Não afeta gaveta (vai pra conta) |
| Débito | `sale_debit` | ❌ Não afeta gaveta (vai pra conta) |
| Crédito | `sale_credit` | ❌ Não afeta gaveta (vai pra conta) |
| Voucher | `sale_voucher` | ❌ Não afeta gaveta |

> ⚠️ **IMPORTANTE:** Apenas `sale_cash` e `sangria`/`supply` alteram o saldo de DINHEIRO FÍSICO na gaveta. Pix, débito e crédito são meios eletrônicos. No fechamento, a conferência é APENAS sobre o dinheiro em espécie. Os meios eletrônicos são conferidos pelo extrato bancário.

### 2.3 Registro automático (fluxo)

```
VENDA FINALIZADA
      │
      ▼
┌─────────────────────────────────────┐
│  Buscar caixa aberto da loja        │
│  Se não existir: BLOQUEAR venda     │
│  (operador precisa abrir caixa)     │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│  Criar transação:                   │
│  {                                  │
│    type: sale_{paymentMethod},      │
│    value: order total,              │
│    paymentMethod,                   │
│    orderId,                         │
│    operatorId,                      │
│    createdAt: now                   │
│  }                                  │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│  Atualizar totals no CashRegister:  │
│  totals[pix] += 73,50               │
│  totals[cash] += 45,00              │
│  totals[credit] += 120,00           │
│  ...                                │
└─────────────────────────────────────┘
```

### 2.4 Sangria (retirada de dinheiro)

**Quando ocorre:**
- Pagamento de fornecedor em dinheiro
- Troco insuficiente → buscar dinheiro no cofre (é suprimento, não sangria)
- Retirada do caixa para depósito bancário no meio do dia
- Retirada do lucro do dia antes do fechamento

**Fluxo de sangria:**

```
  OPERADOR → clica "Sangria"
      │
      ▼
  ┌─────────────────────────────────────┐
  │  MODAL DE SANGRIA                   │
  │                                     │
  │  Valor: [R$____]                    │
  │  Motivo: [dropdown + texto livre]   │
  │    • Pagamento fornecedor           │
  │    • Depósito bancário              │
  │    • Troco para outro caixa         │
  │    • Outro (justificar)             │
  │                                     │
  │  Observação: [obrigatória]          │
  │                                     │
  │  ┌─Confirmar─┐  ┌Cancelar┐         │
  └─────────────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────────┐
  │  VALIDAÇÕES:                        │
  │  ✓ Valor > 0                        │
  │  ✓ Valor <= saldo atual em caixa   │
  │    (initialBalance + sale_cash      │
  │     - sangrias + supplies)          │
  │  ✓ Justificativa preenchida         │
  └──────────────┬──────────────────────┘
                 │
                 ▼
  ┌─────────────────────────────────────┐
  │  Criar transação tipo 'sangria'     │
  │  Atualizar totals.sangrias += valor │
  │  Exibir comprovante de sangria      │
  │  (opcional: imprimir)               │
  └─────────────────────────────────────┘
```

### 2.5 Suprimento (reforço de dinheiro)

**Quando ocorre:**
- Troco estava baixo e foi reabastecido
- Caixa recebeu dinheiro do cofre/gerência

**Regras:**
- Sempre precisa de justificativa
- Valor positivo
- Pode ser feito mesmo por supervisor sem caixa aberto (ex: gerente)

### 2.6 Ajuste (supervisor)

**Quando ocorre:**
- Erro de lançamento (ex: venda registrada como dinheiro mas foi débito)
- Diferença identificada durante o expediente

**Regras:**
- Apenas Administrador ou MasterAdmin
- Justificativa OBRIGATÓRIA
- Registrado em log separado (auditoria)
- Notifica gerente via console operacional

---

## 3. FECHAMENTO DE CAIXA

### 3.1 Quando fechar

| Situação | Comportamento |
|----------|---------------|
| Fim do expediente do operador | Fechamento voluntário |
| Término do horário da loja | Fechamento obrigatório |
| Troca de turno (operador) | Fechamento parcial + abertura novo caixa |
| Meia-noite (cron job) | Fechamento automático FORÇADO |
| Queda de sistema | Recuperação no reabertura |

### 3.2 Fluxo de fechamento

```
                    ┌──────────────────────────┐
                    │  OPERADOR → "Fechar Caixa"│
                    └──────────┬───────────────┘
                               │
                               ▼
          ┌─────────────────────────────────────────┐
          │  VALIDAÇÕES INICIAIS:                   │
          │  ✓ Caixa está aberto                    │
          │  ✓ Operador é o mesmo que abriu         │
          │    OU é Admin/Supervisor                │
          └──────────────────┬──────────────────────┘
                             │
                             ▼
    ┌────────────────────────────────────────────────────────┐
    │            RESUMO DO EXPEDIENTE                        │
    │                                                        │
    │  ┌────────────────────────────────────────┐            │
    │  │  LOJA: Restro Sabor                   │            │
    │  │  OPERADOR: Felipe C.                  │            │
    │  │  PERÍODO: 08:00 — 22:00               │            │
    │  │  ABERTURA: 14/07/2026                 │            │
    │  ├────────────────────────────────────────┤            │
    │  │                                        │            │
    │  │  ENTRADAS (VENDAS)                     │            │
    │  │  Dinheiro .......... R$ 847,32         │            │
    │  │  Pix ............... R$ 523,00         │  (eletrônico)│
    │  │  Débito ............ R$ 312,00         │  (eletrônico)│
    │  │  Crédito ........... R$ 165,00         │  (eletrônico)│
    │  │  Voucher ........... R$ 0,00           │            │
    │  │  ──────────────────────────────────    │            │
    │  │  TOTAL VENDAS ...... R$ 1.847,32       │            │
    │  │                                        │            │
    │  │  MOVIMENTAÇÕES                         │            │
    │  │  Suprimentos ....... R$ 50,00          │            │
    │  │  Sangrias .......... (R$ 200,00)       │            │
    │  │  ──────────────────────────────────    │            │
    │  │  SALDO ESPERADO .... R$ 697,32         │  (dinheiro) │
    │  │                                        │            │
    │  │  ┌──────────────────────────┐          │            │
    │  │  │ VALOR REAL EM DINHEIRO:  │          │            │
    │  │  │ [R$ ______________]     │          │            │
    │  │  └──────────────────────────┘          │            │
    │  │                                        │            │
    │  │  DIFERENÇA: R$ 2,68 (para mais)       │            │
    │  │  ┌─ OK? ────────────────────┐          │            │
    │  │  │  • Justificativa (se >R$50): [____] │            │
    │  │  └────────────────────────────────────┘│            │
    │  │                                        │            │
    │  │  ┌─ Confirmar Fechamento ─┐ ┌Cancelar┐ │            │
    │  └────────────────────────────────────────┘            │
    └────────────────────────────────────────────────────────┘
```

### 3.3 Cálculo detalhado

```javascript
// Cálculo do saldo esperado em DINHEIRO (físico)
expectedCash = initialBalance
  + totals.cash      // Vendas em dinheiro (entrou na gaveta)
  + totals.supplies  // Reforços (entrou na gaveta)
  - totals.sangrias  // Retiradas (saiu da gaveta)

// Exemplo real:
initialBalance = 200,00
+ sale_cash    = 847,32
+ supplies     =   50,00
- sangrias     = (200,00)
= expectedCash =  897,32

// Operador conta a gaveta e digita:
actualCash = 900,00

// Diferença:
difference = 900,00 - 897,32 = +2,68  (sobra de R$ 2,68)
```

### 3.4 Tratamento de diferenças

| Diferença | Comportamento |
|-----------|--------------|
| **R$ 0,00** | Perfeito — fechamento aprovado automaticamente |
| **< R$ 5,00** | Aviso "Pequena diferença" — fechamento permitido |
| **R$ 5,00 a R$ 50,00** | Justificativa OBRIGATÓRIA do operador |
| **> R$ 50,00** | Bloqueado — requer aprovação de supervisor + justificativa |
| **> R$ 200,00** | Alerta no console operacional + notificação ao admin |

### 3.5 Aprovação de supervisor (diferenças grandes)

```
  DIFERENÇA > R$ 50,00
         │
         ▼
  ┌─────────────────────────────────────────┐
  │  NOTIFICAÇÃO ao supervisor:             │
  │                                         │
  │  📢 CAIXA COM DIFERENÇA ACIMA DO LIMITE │
  │                                         │
  │  Operador: Felipe C.                    │
  │  Esperado: R$ 897,32                    │
  │  Real: R$ 800,00                        │
  │  Diferença: -R$ 97,32 (falta)           │
  │                                         │
  │  Justificativa do operador:             │
  │  "Troquei R$ 100,00 em notas de 20      │
  │   por uma de 100 e esqueci de           │
  │   registrar como sangria"               │
  │                                         │
  │  ┌─ Aprovar com ressalva ─┐ ┌Recusar┐  │
  └─────────────────────────────────────────┘
```

### 3.6 Fechamento forçado (meia-noite / cron)

```
  ┌────────────────────────────────┐
  │  CRON: 23:55 todos os dias     │
  │  Verificar caixas abertos      │
  └───────────┬────────────────────┘
              │
              ▼
  ┌────────────────────────────────┐
  │  Para cada caixa aberto:       │
  │  • status = 'closed'           │
  │  • closedAt = now              │
  │  • closingSummary.expectedCash │
  │    = calculado automaticamente │
  │  • closingSummary.actualCash   │
  │    = null (não conferido)      │
  │  • closingSummary.difference   │
  │    = null (pendente)           │
  │  • forced: true                │
  └───────────┬────────────────────┘
              │
              ▼
  ┌────────────────────────────────┐
  │  Notificar admin:              │
  │  "Caixa do operador X foi      │
  │   fechado automaticamente.     │
  │   Conferência pendente."       │
  └────────────────────────────────┘
```

### 3.7 Fechamento por troca de turno

```
  TURNO A (08:00-14:00)
  ┌─────────────────────────────┐
  │  Operador A abre caixa      │
  │  Vende R$ 1.200,00         │
  │  Sangria de R$ 300,00      │
  │                             │
  │  FECHA CAIXA:               │
  │  • Conta gaveta             │
  │  • Registra diferença       │
  │  • Assina digitalmente      │
  │  • status = 'closed'        │
  └─────────────────────────────┘
         ↓
  TURNO B (14:00-22:00)
  ┌─────────────────────────────┐
  │  ABRE NOVO CAIXA:           │
  │  Saldo inicial = saldo      │
  │  final em dinheiro do       │
  │  turno A                    │
  │                             │
  │  Vende R$ 647,32           │
  │  Suprimento de R$ 50,00     │
  │                             │
  │  FECHA CAIXA                │
  └─────────────────────────────┘
```

---

## 4. CONSULTAS E RELATÓRIOS

### 4.1 Histórico de caixas

```
┌──────────────────────────────────────────────────────┐
│  HISTÓRICO DE CAIXAS                                 │
│  LOJA: Restro Sabor                                  │
├────────┬──────────┬──────────┬───────┬───────┬───────┤
│ OPERADOR│ ABERTURA │ FECHAMENTO│ VENDAS│DIFER.│STATUS │
├────────┼──────────┼──────────┼───────┼───────┼───────┤
│ Felipe │ 08:00    │ 22:00    │1.847  │+2,68  │✅ OK  │
│ Maria  │ 14:00    │ 22:00    │1.200  │+0,50  │✅ OK  │
│ João   │ 08:00    │ 12:00    │ 980   │-15,00 │⚠️ Just│
│ Carlos │ 22:00    │ forçado  │ 320   │  —    │🔴 Pen │
└────────┴──────────┴──────────┴───────┴───────┴───────┘
```

### 4.2 Fechamento do dia (consolidado)

Ao final do dia, todos os caixas da loja são consolidados:

```javascript
// GET /api/cash-register/daily-summary?date=2026-07-14
{
  storeId: "...",
  date: "2026-07-14",
  registers: [
    { operator: "Felipe C.", openedAt: "08:00", closedAt: "22:00", ... },
    { operator: "Maria S.", openedAt: "14:00", closedAt: "22:00", ... }
  ],
  consolidatedTotals: {
    cash: 1847.32,     // soma de todos os caixas
    pix: 1523.00,
    debit: 612.00,
    credit: 465.00,
    voucher: 0,
    sangrias: 500.00,
    supplies: 150.00,
    grossSales: 4447.32,
    netCash: 1497.32   // cash + supplies - sangrias
  },
  cashDifference: {
    total: 3.18,       // soma das diferenças de todos os caixas
    registersWithDiff: 2,
    pendingReconciliation: 1   // caixa forçado sem conferência
  }
}
```

### 4.3 Indicadores no dashboard

| Métrica | Cálculo | Onde exibir |
|---------|---------|-------------|
| Caixa aberto agora | CashRegister.status === 'open' | Header do PDV (badge) |
| Faturamento do dia | sum(totals.*) | Home / MiniCard |
| Diferença total | sum(closingSummary.difference) | Dashboard admin |
| Caixas pendentes | forced === true && actualCash === null | Console operacional |

---

## 5. REGRAS DE NEGÓCIO (RESUMO)

### 5.1 Regras obrigatórias

| # | Regra | Violação resulta em |
|---|-------|---------------------|
| 1 | Toda venda exige caixa aberto | Bloqueio de venda |
| 2 | Um caixa por loja por vez | Bloqueio de abertura |
| 3 | Sangria não pode exceder saldo disponível em dinheiro | Bloqueio da sangria |
| 4 | Fechamento com diferença > R$ 50 exige supervisor | Bloqueio até aprovação |
| 5 | Justificativa obrigatória em sangria e suprimento | Bloqueio do lançamento |
| 6 | Apenas operador que abriu (ou admin) pode fechar | Bloqueio do fechamento |
| 7 | Fechamento forçado às 00:00 (cron) | Execução automática |
| 8 | Diferença > R$ 200 dispara alerta no console | Notificação automática |

### 5.2 Regras recomendadas

| # | Regra | Motivo |
|---|-------|--------|
| 9 | Suprimento só por supervisor | Evitar "maquiagem" de caixa |
| 10 | Troco inicial não pode ser sangrado | Troco deve permanecer para próximo turno |
| 11 | Impressão de comprovante de sangria | Rastreabilidade física |
| 12 | Histórico de caixa visível apenas para Admin+ | Segurança da informação |
| 13 | Caixa fechado não pode ser reaberto | Integridade contábil |
| 14 | Caixa forçado deve ser conferido em até 24h | Evitar acúmulo de pendências |

---

## 6. ENDPOINTS DA API

### 6.1 Cash Register

```javascript
// Abertura
POST   /api/cash-register/open
       Body: { storeId, initialBalance, notes? }
       Res:  { cashRegister }

// Fechamento
POST   /api/cash-register/:id/close
       Body: { actualCash, differenceReason? }
       Res:  { cashRegister, closingSummary }

// Sangria
POST   /api/cash-register/:id/sangria
       Body: { value, reason, description }
       Res:  { cashRegister, transaction }

// Suprimento
POST   /api/cash-register/:id/supply
       Body: { value, reason, description }
       Res:  { cashRegister, transaction }

// Ajuste (supervisor)
POST   /api/cash-register/:id/adjustment
       Body: { value, reason, description }
       Res:  { cashRegister, transaction }
```

### 6.2 Consultas

```javascript
// Caixa atual (aberto) da loja
GET    /api/cash-register/current?storeId=...
       Res:  { cashRegister } | 404

// Histórico de caixas
GET    /api/cash-register/history?storeId=...&page=1&limit=20
       Res:  { registers: [...], total, page, pages }

// Resumo diário consolidado
GET    /api/cash-register/daily-summary?storeId=...&date=YYYY-MM-DD
       Res:  { summary }

// Transações de um caixa
GET    /api/cash-register/:id/transactions
       Res:  { transactions: [...] }
```

### 6.3 Relatórios

```javascript
// Diferenças do período
GET    /api/reports/cash-differences?storeId=...&start=&end=
       Res:  { differences: [...], totalDiff, totalRegisters }

// Vendas por operador
GET    /api/reports/by-operator?storeId=...&period=
       Res:  { operators: [{ name, sales, orders, cashDifference }] }

// Sangrias do período
GET    /api/reports/sangrias?storeId=...&start=&end=
       Res:  { sangrias: [...], total }
```

---

## 7. DIAGRAMA DE ESTADOS

```
                    ┌────────────────────────────────────────────────┐
                    │           CASH REGISTER - STATE MACHINE        │
                    └────────────────────────────────────────────────┘

                              [INEXISTENTE]
                                    │
                           (operador faz login)
                                    │
                                    ▼
                            ┌───────────────┐
                   ┌────────┤   ABRINDO     ├─────────┐
                   │        │  (validação)   │         │
                   │        └───────┬───────┘         │
                   │                │                  │
                   │         ┌──────▼──────┐          │
                   │         │   OPEN      │          │
                   │         │ (operação)  │          │
                   │         └─┬──┬──┬──┬──┘          │
                   │    ┌──────┘  │  │  └──────┐      │
                   │    │        │  │         │      │
                   ▼    ▼        ▼  ▼         ▼      ▼
               ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐
               │VENDA│ │VENDA│ │SAN │ │SUP │ │AJUS│ │... │
               │DINH │ │PIX │ │GRIA│ │RIM │ │TE  │ │    │
               └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘ └────┘
                  │       │       │       │       │
                  └───────┴───────┴───────┴───────┴──────┘
                                          │
                                  (operador fecha)
                                          │
                                          ▼
                                 ┌────────────────┐
                    ┌────────────┤   FECHANDO     │
                    │            │ (conferência)   │
                    │            └───────┬────────┘
                    │                    │
              ┌─────┴─────┐       ┌──────▼──────┐
              │ DIF < R$5 │       │  DIF > R$50  │
              │ (auto OK) │       │  (sup. req.) │
              └─────┬─────┘       └──────┬───────┘
                    │                    │
                    └──────┬─────────────┘
                           │
                    ┌──────▼──────┐
                    │   CLOSED    │
                    │  (fechado)  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   ARQUIVADO │  (24h depois)
                    │ (imutável)  │
                    └─────────────┘

  (meia-noite)
  ─────────────────────────────────────────────
      OPEN ───────────────────→ CLOSED (forced)
```

---

## 8. INTERFACE DO USUÁRIO

### 8.1 Indicador de status no header

```
┌───────────────────────────────────────────────────┐
│  🍽️ Restro     🔍 [   ]    👤 Felipe C. 🔔 🔌   │
│                        CAIXA #42 [🟢 Aberto]       │
│                        R$ 897,32 em dinheiro       │
└───────────────────────────────────────────────────┘
```

- Badge colorido: 🟢 Aberto / 🔴 Fechado / 🟡 Pendente
- Número do caixa (sequencial do dia)
- Saldo atual em dinheiro (para conferência rápida)

### 8.2 Botões no PDV (PdvFooterActions)

```
┌──────────────────────────────────────────────────────┐
│ [🧾 Pré-venda] [📋 Comanda] [☕ Mesas] [🖥️ Caixa] [📍Delivery] [💰 Fechar] [🖨️ Imprimir] [🚪 Sair] │
│                                          └───┬───┘  │
│                                        (ex-sangria   │
│                                         + suprimento)│
└──────────────────────────────────────────────────────┘
```

O botão "Fechar" (💰) abre um submenu:

```
  ┌─────────────┐
  │ 💰 Fechar    │
  ├─────────────┤
  │ Sangria...   │
  │ Suprimento.. │
  │ ─────────── │
  │ 🔒 Fechar   │
  │    Caixa     │
  └─────────────┘
```

---

## 9. PITFALLS E CASOS DE BORDA

| Situação | Como tratar |
|----------|-------------|
| **Operador esqueceu de abrir caixa e já vendeu** | Bloquear. Não pode registrar venda sem caixa. Operador precisa abrir com data retroativa? ❌ Não permitir. Venda é perdida? Sim, infelizmente — isso força a disciplina. Alternativa: admin pode criar ajuste. |
| **Caixa aberto, operador foi embora sem fechar** | Cron fecha às 00:00. Operador precisa conferir no dia seguinte com supervisor. |
| **Sistema caiu no meio da venda** | Se venda foi salva no banco, transação é registrada quando sistema voltar. Se não foi salva, venda é perdida (modo offline ajuda aqui). |
| **Dois operadores no mesmo caixa (restaurante pequeno)** | Apenas 1 caixa por loja. Ambos operam no mesmo. Quem fechar pode ser qualquer um. |
| **Cliente pagou parte em dinheiro, parte em PIX** | Duas transações: `sale_cash` + `sale_pix`. Ambas vinculadas ao mesmo `orderId`. |
| **Sangria no final do dia "para não deixar dinheiro no caixa"** | Permitido, mas deve constar no resumo. O fechamento considera a sangria. |
| **Diferença de R$ 0,01 (centavo)** | Ignorar. Pode ser erro de arredondamento contábil. Fechamento aceito. |
| **Operador fechou sem conferir dinheiro (emergência)** | forced = true. Supervisor precisa conferir depois. |
| **Troco devolvido ao cliente (desistência)** | Não é transação de caixa. É cancelamento de item no pedido. |
| **Caixa com saldo inicial alto (ex: R$ 1.000)** | Permitido. O sistema não limita, mas o supervisor deve questionar se for incomum. |

---

## 10. INTEGRAÇÕES COM OUTROS MÓDULOS

### 10.1 Comanda fiscal (NFC-e)

O total de vendas do caixa DEVE bater com o total de NFC-e emitidas no dia.

```
Relatório do caixa:                  Relatório fiscal (SEFAZ):
┌─────────────────┐                  ┌─────────────────┐
│ Vendas: R$4.447 │                  │ NFC-e: R$4.447  │
│ Dinheiro: 1.847 │                  │ 42 documentos   │
│ Pix: 1.523      │                  │                 │
│ Débito: 612     │                  │                 │
│ Crédito: 465    │                  │                 │
└─────────────────┘                  └─────────────────┘
         │                                    │
         └─────────── DEVE BATER ─────────────┘
```

Se não bater, o caixa não pode ser fechado até regularização.

### 10.2 Comissão de garçons

A comissão é calculada sobre o total de vendas do garçom (incluindo gorjeta), independente do caixa onde foi registrada.

### 10.3 Fechamento contábil mensal

Ao final do mês, a soma de todos os fechamentos de caixa deve bater com:
- Extrato bancário (Pix, débito, crédito)
- Livro caixa (dinheiro)
- NFC-e emitidas
- Relatório de sangrias

---

## 11. FLUXO COMPLETO (PONTO A PONTO)

```
DIA DO RESTAURANTE — VISÃO COMPLETA

┌──────────────────────────────────────────────────────────────────────┐
│  07:50 — Gerente chega, abre o sistema                              │
│  08:00 — Operador Felipe abre caixa: R$ 200,00                      │
│  08:15 — Venda mesa 5: R$ 85,00 em dinheiro                         │
│  08:30 — Venda balcão: R$ 12,00 em dinheiro                         │
│  09:00 — Venda mesa 3: R$ 145,00 — R$ 100 crédito + R$ 45 dinheiro  │
│  10:30 — Sangria: R$ 200,00 (depósito bancário)                     │
│  11:00 — Venda mesa 8: R$ 73,50 em PIX                              │
│  12:00 — Pico: 12 vendas no horário de almoço                       │
│  14:00 — Felipe sai para almoço. Maria assume o caixa.              │
│          Felipe fecha caixa: R$ 897,32 esperado, R$ 900,00 real     │
│          Diferença: +R$ 2,68 ✅                                      │
│  14:05 — Maria abre caixa: saldo inicial = R$ 700,00 (gaveta atual) │
│  14:30 — Suprimento: R$ 50,00 (troco)                               │
│  18:00 — Pico do jantar: 20 vendas                                  │
│  21:30 — Movimento reduz                                           │
│  22:00 — Maria fecha caixa                                          │
│          R$ 1.200,32 esperado, R$ 1.200,00 real                     │
│          Diferença: -R$ 0,32 ✅                                      │
│  22:05 — Maria deposita R$ 1.200,00 no cofre                        │
│  22:10 — Sistema gera relatório diário                              │
│          Total vendas: R$ 4.447,32                                   │
│          Total NFC-e: 42                                            │
│          Divergência: R$ 0,00 🟢                                    │
│  00:00 — Cron força fechamento de qualquer caixa pendente           │
└──────────────────────────────────────────────────────────────────────┘
```

---

Este documento define o fluxo completo de gerenciamento de caixa para um restaurante brasileiro. A implementação deve seguir a ordem: **Modelo de dados → Endpoints → Frontend (indicador + sangria/suprimento → fechamento → relatórios)**.
