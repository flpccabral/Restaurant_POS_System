# FLUXO DE RESERVAS — AGENDAMENTO, CALENDÁRIO E CONFIRMAÇÃO

## VISÃO GERAL

Reservas permitem que clientes agendem mesas com antecedência. Diferente da alocação no momento (que o sistema já faz ao abrir uma mesa), a reserva é um compromisso futuro: data, horário, número de convidados e (opcionalmente) mesa específica.

```
  RESERVA → CONFIRMAÇÃO → CHEGADA → OCUPAÇÃO → SAÍDA
                              │
                         Se não comparecer:
                              ↓
                         NO-SHOW (registrado)
```

---

## 1. MODELO RESERVATION

```javascript
{
  _id, storeId,
  tableId: ObjectId,              // Mesa específica (opcional)
  tableNo: Number,                // Número da mesa (para exibição)
  customerName: String,
  customerPhone: String,
  guests: Number,
  date: Date,                     // Data da reserva
  time: String,                   // Horário "19:30"
  status: String,                 // pending | confirmed | seated | cancelled | no_show
  notes: String,                  // "Aniversário", "Preferência área vip"
  source: String,                 // phone | digital | in_person
  operatorId: ObjectId,           // Quem registrou

  // Timeline
  confirmedAt: Date,
  seatedAt: Date,                 // Quando a mesa foi ocupada
  cancelledAt: Date,
  cancelReason: String,
  noShowAt: Date,                 // Quando foi marcado como não compareceu

  // Recorrência
  isRecurring: Boolean,           // Reserva recorrente?
  recurringPattern: String,       // weekly | biweekly | monthly

  createdAt, updatedAt
}
```

---

## 2. FLUXO DE RESERVA

### 2.1 Criação

```
  OPERADOR → /reservations → "Nova Reserva"
       │
       ▼
  ┌─────────────────────────────────────────┐
  │  NOVA RESERVA                           │
  │                                         │
  │  Cliente:                               │
  │  Nome*: [________]                     │
  │  Telefone*: [________]                 │
  │  Convidados*: [4]                      │
  │                                         │
  │  Data: [15/07/2026]                    │
  │  Horário: [19:30]                      │
  │                                         │
  │  Mesa:                                  │
  │  ○ Automática (sugerir melhor mesa)    │
  │  ○ Mesa específica: [Mesa 5▼]          │
  │    (mostrar apenas mesas disponíveis   │
  │     no horário)                        │
  │                                         │
  │  Observações: [________]               │
  │                                         │
  │  ┌─ Salvar ─┐  ┌─ Cancelar ─┐         │
  └─────────────────────────────────────────┘
```

### 2.2 Sugestão automática de mesa

```javascript
// Busca mesas disponíveis no horário:
function suggestTable(storeId, guests, date, time) {
  // 1. Todas as mesas da loja com capacidade >= guests
  // 2. Excluir mesas com reserva confirmada no mesmo horário
  //    (janela de 2h: 18:30 - 20:30 para reserva 19:30)
  // 3. Excluir mesas ocupadas (Booked) na data
  // 4. Ordenar por: menor capacidade que atende (evitar desperdício)
  // 5. Retornar top 3
}
```

### 2.3 Timeline da reserva

```
  H-7d ─── Criada (status: pending)
  H-24h ── Lembrete automático (opcional: SMS/WhatsApp)
  H-2h ─── Lembrete final
  H ────── Cliente chega
  H+30min ─ Se não chegou: operador liga
  H+1h ─── Se não atendeu: status = 'no_show', mesa liberada
```

### 2.4 Check-in (chegada do cliente)

```
  CLIENTE CHEGA → OPERADOR → "Confirmar Chegada"
       │
       ▼
  ┌─────────────────────────────────────────┐
  │  1. Busca reserva pelo nome/telefone    │
  │  2. Reservation.status = 'seated'       │
  │  3. Mesa.status = 'Booked'             │
  │  4. Cria Order na mesa (se cliente      │
  │     quiser pedir na hora)               │
  │  5. Garçom vinculado à mesa            │
  │  6. Timer de permanência inicia         │
  │     (alerta se > 2h)                    │
  └─────────────────────────────────────────┘
```

---

## 3. VISÃO DO DIA (CALENDÁRIO)

### 3.1 Layout

```
  ┌─────────────────────────────────────────────┐
  │  RESERVAS — 15 DE JULHO DE 2026             │
  │  [◀ 14] [15 • Hoje] [16 ▶]                 │
  ├─────────────────────────────────────────────┤
  │                                             │
  │  ┌──────┬──────┬──────┬──────┬──────┐      │
  │  │       MANHÃ                       │      │
  │  ├──────┼──────┼──────┼──────┼──────┤      │
  │  │11:00 │11:30 │12:00 │12:30 │13:00 │      │
  │  │      │      │João  │Maria │      │      │
  │  │      │      │M5/4p │M3/6p │      │      │
  │  ├──────┴──────┴──────┴──────┴──────┤      │
  │  │              NOITE               │      │
  │  ├──────┬──────┬──────┬──────┬──────┤      │
  │  │19:00 │19:30 │20:00 │20:30 │21:00 │      │
  │  │Carlos│Ana   │      │Pedro │      │      │
  │  │M2/2p │M8/4p │      │M1/4p │      │      │
  │  └──────┴──────┴──────┴──────┴──────┘      │
  │                                             │
  │  LEGENDA:                                   │
  │  🟢 Confirmada  🟡 Pendente  🔴 No-show    │
  │  🔵 Em andamento (ocupou mesa)              │
  └─────────────────────────────────────────────┘
```

---

## 4. RELATÓRIO DE RESERVAS

| Métrica | Cálculo |
|---------|---------|
| Taxa de ocupação | `(total seated / total mesas) * 100` |
| No-show rate | `(no_show / total confirmed) * 100` |
| Horário mais reservado | Hora com mais reservas |
| Cancelamento rate | `(cancelled / total) * 100` |
| Ticket médio reserva | `avg(order_total) para seated reservations` |

---

## 5. REGRAS DE NEGÓCIO

| # | Regra |
|---|-------|
| 1 | Reserva pode ser feita com até 30 dias de antecedência |
| 2 | Mínimo de 1 hora de antecedência |
| 3 | Reserva não confirmada até H-2h → automaticamente cancelada |
| 4 | No-show registrado após 30 min do horário reservado |
| 5 | 3 no-shows consecutivos → cliente bloqueado de fazer novas reservas |
| 6 | Mesa reservada NÃO pode ser ocupada por outro cliente |
| 7 | Se mesa reservada chegar e estiver ocupada (erro operacional), realocar |
| 8 | Se reserva não especificar mesa, operador aloca na chegada |
| 9 | Limite de permanência: 2h almoço, 3h jantar (configurável) |
| 10 | Reserva NÃO cria order automaticamente (cliente pede quando chegar) |

---

## 6. ENDPOINTS

```javascript
// CRUD
GET    /api/reservations?date=&status=&storeId=
POST   /api/reservations                       // Criar
PUT    /api/reservations/:id                    // Atualizar
DELETE /api/reservations/:id                    // Cancelar

// Ações
POST   /api/reservations/:id/confirm            // Confirmar
POST   /api/reservations/:id/seated              // Check-in (chegou)
POST   /api/reservations/:id/no-show             // Não compareceu

// Relatórios
GET    /api/reports/reservations?period=&storeId=

// Calendário
GET    /api/reservations/calendar?date=&storeId= // Visão do dia

// Sugestão de mesa
GET    /api/reservations/suggest-table?guests=&date=&time=&storeId=
```
