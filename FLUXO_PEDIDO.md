# FLUXO DO PEDIDO — SISTEMAS BRASILEIROS REAIS

## VISÃO GERAL NO SETOR

No restaurante brasileiro, o pedido começa quando o **garçom** (não um operador de caixa) anota o que o cliente pediu. O fluxo reflete a realidade de salão: garçom → comanda → cozinha → serviço → pré-conta → pagamento.

```
REALIDADE DO RESTAURANTE BRASILEIRO:

  CLIENTE SENTA
       ↓
  GARÇOM → Anota pedido (comanda de papel ou tablet)
       ↓
  COZINHA → Prepara → Pronto
       ↓
  GARÇOM → Serve
       ↓
  CLIENTE → Come → "A conta, por favor"
       ↓
  PRÉ-CONTA → Cliente confere → OK?
       ↓
  PAGAMENTO → Maquininha + split → Gorjeta
       ↓
  FECHAMENTO DA MESA
```

---

## 1. FLUXO COMPLETO NO BRASIL

### 1.1 Etapas do atendimento

```
  ┌──────────────────────────────────────────────┐
  │  1. CHEGADA                                  │
  │  • Cliente senta na mesa                     │
  │  • Garçom pergunta quantas pessoas           │
  │  • Se reserva: confirmar nome                │
  │  • Garçom leva comanda/cardápio              │
  └────────────────────┬─────────────────────────┘
                       │
                       ▼
  ┌──────────────────────────────────────────────┐
  │  2. PEDIDO INICIAL                           │
  │  • Garçom anota no tablet ou comanda         │
  │  • Itens: nome + quantidade + observação     │
  │  • "Ponto da carne?", "Sem cebola?"          │
  │  • Bebidas saem primeiro                     │
  │  • Envia para cozinha/bar                    │
  └────────────────────┬─────────────────────────┘
                       │
                       ▼
  ┌──────────────────────────────────────────────┐
  │  3. COZINHA / KDS                            │
  │  • Pedido chega na tela da cozinha           │
  │  • Cozinha prepara                           │
  │  • "Prato pronto" — cozinha avisa            │
  │  • Garçom leva à mesa                        │
  └────────────────────┬─────────────────────────┘
                       │
  ┌──────────────────────────────────────────────┐
  │  4. SOBREMESA / MAIS PEDIDOS                 │
  │  • Garçom volta: "Mais alguma coisa?"       │
  │  • Se sim: novo pedido (na mesma comanda)    │
  │  • Se não: "Algo mais? Trago a conta?"      │
  └────────────────────┬─────────────────────────┘
                       │
                       ▼
  ┌──────────────────────────────────────────────┐
  │  5. PRÉ-CONTA                                │
  │  • Cliente pede a conta                      │
  │  • Garçom gera pré-conta:                    │
  │    ┌────────────────────────────────────┐    │
  │    │ RESTRO SABOR                       │    │
  │    │ MESA 5 — 15/07/2026 20:30          │    │
  │    │                                    │    │
  │    │ 2x Filé c/ fritas      R$ 70,00   │    │
  │    │ 1x Salada Caesar       R$ 28,00   │    │
  │    │ 3x Coca-Cola           R$ 15,00   │    │
  │    │ 1x Petit Gateau        R$ 22,00   │    │
  │    │ ───────────────────────────────── │    │
  │    │ Subtotal                R$ 135,00 │    │
  │    │ Serviço 10%             R$ 13,50  │    │
  │    │ TOTAL                   R$ 148,50 │    │
  │    └────────────────────────────────────┘    │
  │  • Cliente confere                           │
  │  • "Tudo certo?"                             │
  │  • Se cliente discordar: ajuste              │
  └────────────────────┬─────────────────────────┘
                       │
                       ▼
  ┌──────────────────────────────────────────────┐
  │  6. PAGAMENTO                                │
  │  • Garçom: "Vai dividir?"                    │
  │  • Se sim: operação de split                 │
  │  • Garçom leva maquininha na mesa            │
  │  • Cliente paga (cartão/PIX/dinheiro)        │
  │  • Garçom volta ao PDV e confirma            │
  └────────────────────┬─────────────────────────┘
                       │
                       ▼
  ┌──────────────────────────────────────────────┐
  │  7. GORJETA (10%)                            │
  │  • Pergunta: "Vai pagar o serviço?"          │
  │  • Se sim: o valor já está na conta          │
  │  • Se não: desconta do total                  │
  │  • Cliente pode pagar a gorjeta em dinheiro  │
  │    separado (não passa na maquininha)         │
  └────────────────────┬─────────────────────────┘
                       │
                       ▼
  ┌──────────────────────────────────────────────┐
  │  8. FECHAMENTO                               │
  │  • Garçom confirma pagamento no POS          │
  │  • Mesa liberada                             │
  │  • Gorjeta registrada para distribuição      │
  │  • NFC-e emitida                             │
  └──────────────────────────────────────────────┘
```

---

## 2. MODOS DE ATENDIMENTO

### 2.1 Salão (dine_in) — o mais comum

```
  ┌─────────────────────────────────────────────┐
  │  SALÃO — FLUXO COMPLETO                     │
  │                                             │
  │  Vantagem: cliente pode fazer vários        │
  │  pedidos, a conta acumula na mesa           │
  │                                             │
  │  Order.status                              │
  │  ├── "In Progress"  → cada novo pedido     │
  │  ├── "Ready"        → cozinha liberou      │
  │  ├── "completed"    → garçom serviu        │
  │  │                   (permanece aberto)     │
  │  ├── ... (mais pedidos acumulam)            │
  │  └── closeStatus = 'closed' → mesa paga    │
  └─────────────────────────────────────────────┘
```

### 2.2 Balcão (counter) — o mais simples

```
  ┌─────────────────────────────────────────────┐
  │  BALCÃO — PAGAMENTO IMEDIATO               │
  │                                             │
  │  Cliente chega no balcão:                   │
  │  1. Pede (pão na chapa + café)              │
  │  2. Paga na hora (dinheiro, PIX, cartão)    │
  │  3. Aguarda                                  │
  │  4. Recebe e consome no balcão ou leva      │
  │                                             │
  │  Order.paymentStatus = 'paid' (imediato)    │
  │  Não acumula pedidos                        │
  └─────────────────────────────────────────────┘
```

### 2.3 Comanda (fichas) — bares

```
  ┌─────────────────────────────────────────────┐
  │  BAR — COMANDA FÍSICA / DIGITAL             │
  │                                             │
  │  • Garçom entrega comanda numerada          │
  │  • Cliente pede e o garçom LANÇA no sistema │
  │    vinculado ao número da comanda           │
  │  • Ao pagar, fecha a comanda               │
  │  • Diferente de mesa: não tem assento fixo  │
  │                                             │
  │  OrderType: 'comanda' (adicionar)           │
  └─────────────────────────────────────────────┘
```

---

## 3. PRÉ-CONTA

### 3.1 O que é

Pré-conta é o resumo dos itens consumidos **antes do pagamento**. O cliente confere, pede ajustes se necessário, e só então autoriza o pagamento.

### 3.2 Fluxo

```
  CLIENTE: "A conta, por favor"
       │
       ▼
  ┌─────────────────────────────────────────┐
  │  GARÇOM NO TABLET: "Pré-Conta"         │
  │                                         │
  │  Gera PDF / tela com:                   │
  │  • Todos os itens (agrupados)           │
  │  • Subtotal                             │
  │  • 10% (se aplicável)                   │
  │  • Total                                │
  │                                         │
  │  Cliente confere:                       │
  │  ├── "Tudo certo" → pagamento          │
  │  ├── "Esse item não veio" → ajuste (-) │
  │  └── "Faltou esse item" → ajuste (+)   │
  └─────────────────────────────────────────┘
```

### 3.3 Regras

| # | Regra |
|---|-------|
| 1 | Pré-conta NÃO altera status do pedido (pedidos continuam abertos) |
| 2 | Cliente pode pedir mais itens após ver a pré-conta |
| 3 | Ajuste na pré-conta registra no log: "Cliente solicitou remoção do item X" |
| 4 | Pré-conta pode ser impressa (impressora não-fiscal) para o cliente levar |

---

## 4. GORJETA (10%) — REALIDADE BRASILEIRA

### 4.1 Como funciona na prática

```
  REALIDADE DO 10% NO BRASIL:

  90% dos restaurantes: gorjeta já vem INCLUÍDA na conta
  → Cliente PODE solicitar a remoção
  → Se remover: sistema desconta e registra
  → Garçom NÃO pergunta "vai pagar o serviço?" (constrangedor)
  → O valor fica na própria conta do restaurante
  → Restaurante distribui entre os garçons no fim do mês

  10% dos restaurantes: gorjeta é OPCIONAL
  → Perguntam "Vai incluir o serviço?"
  → Mais comum em restaurantes de alto padrão
```

### 4.2 Implementação correta

```javascript
// 10% NÃO é toggle no PDV — é DEFAULT incluso
serviceCharge = subtotal * 0.10
total = subtotal + serviceCharge

// Cliente pode solicitar remoção:
// Se remover: total = subtotal (sem taxa)
// Se pagar em dinheiro separado: registra como transação à parte
```

### 4.3 Distribuição da gorjeta

```
  FIM DO MÊS:
       │
       ▼
  ┌─────────────────────────────────────────┐
  │  CÁLCULO DE DISTRIBUIÇÃO                │
  │                                         │
  │  Total gorjetas no mês: R$ 8.450,00    │
  │                                         │
  │  Garçons ativos: 5                      │
  │  (considerar dias trabalhados)          │
  │                                         │
  │  Distribuição:                          │
  │  • João (22 dias): R$ 1.859,00         │
  │  • Maria (20 dias): R$ 1.690,00        │
  │  • Pedro (18 dias): R$ 1.521,00        │
  │  • Ana (22 dias): R$ 1.859,00          │
  │  • Carlos (15 dias): R$ 1.267,50       │
  │  ──────────────────────────────────    │
  │  • Caixa (fixo): R$ 253,50             │
  └─────────────────────────────────────────┘
```

---

## 5. COUVERT ARTÍSTICO

### 5.1 O que é

Couvert é o **"entrada da casa"** — pão, manteiga, patê servido automaticamente quando o cliente senta. O cliente pode recusar.

### 5.2 Fluxo

```
  CLIENTE SENTA NA MESA
       │
       ├── Garçom serve couvert (pão + patê)
       │
       ├── Se cliente recusou: não cobrar
       │   (garçom retira imediatamente)
       │
       └── Se aceitou: couvert é adicionado
           como item automático no pedido
           (ou no fechamento, se sistema não
            suportar item automático)

  Couvert NÃO entra no 10%
  Couvert é tributado separadamente
```

### 5.3 Regras

| # | Regra |
|---|-------|
| 1 | Couvert só pode ser cobrado se o cliente ACEITOU (Súmula 627 STJ) |
| 2 | Couvert NÃO entra no cálculo do 10% |
| 3 | Couvert pode ser recusado a QUALQUER momento (não só no início) |
| 4 | Se sistema não suporta couvert como item, garçom adiciona manualmente |

---

## 6. STATUS DO PEDIDO — REVISADO

| Estado | Quando | Quem muda | Próximo |
|--------|--------|:---------:|---------|
| `pending` | Pedido criado (antes de enviar) | Garçom | `sent_to_kitchen` |
| `sent_to_kitchen` | Enviado para cozinha | Garçom | `preparing` |
| `preparing` | Cozinha começou | Cozinha | `ready` |
| `ready` | Pronto para servir | Cozinha | `served` |
| `served` | Garçom entregou na mesa | Garçom | `completed` (se último pedido) |
| `completed` | Cliente consumiu | Garçom | — (pedido concluído, mesa aberta) |
| `pre_bill` | Cliente pediu a conta | Garçom | `payment` (visual) |
| `paid` | Pagamento registrado | Garçom/Caixa | — (mesa fecha) |
| `cancelled` | Cancelado (com justificativa) | Garçom/Admin | — |

---

## 7. REGRAS DE NEGÓCIO — REAIS

| # | Regra | Fundamentação |
|---|-------|---------------|
| 1 | Garçom é o centro do fluxo — ele cria, serve, fecha | Prática brasileira |
| 2 | 10% é INCLUSO por padrão, removível a pedido | Cultura do setor |
| 3 | Pré-conta é ETAPA OBRIGATÓRIA antes do pagamento | Costume brasileiro |
| 4 | Cliente pode fazer N pedidos na mesma mesa (acumula) | Restaurante real |
| 5 | Couvert só pode ser cobrado se aceito (STJ Súmula 627) | Jurisprudência |
| 6 | Couvert não entra no 10% | Convenção do setor |
| 7 | Pedido 'completed' ≠ mesa fechada — mesa só fecha no pagamento | Lógica operacional |
| 8 | Garçom pode ajustar pedido (trocar item, adicionar observação) mesmo após enviado | Flexibilidade real |
| 9 | Cancelamento de item após enviado notifica cozinha (WS) para não preparar | Operacional |
| 10 | Cliente pode pedir a conta a QUALQUER garçom (não só o que atendeu) | Costume |

---

## 8. RELAÇÃO COM OUTROS FLUXOS — REVISADA

```
FLUXO_PEDIDO (real)
  ├── FLUXO_KDS → Cozinha prepara os itens
  ├── FLUXO_CAIXA → Registra transação financeira
  ├── FLUXO_PAGAMENTO → Realidade: maquininha na mesa + confirmação manual
  ├── FLUXO_FISCAL → NFC-e emitida após confirmação (não condicionada ao gateway)
  └── FLUXO_USUARIOS → Garçom é o ator principal, não o caixa
```

---

## 9. ENDPOINTS — REVISADOS

```javascript
// Pedido (reflete fluxo real)
POST   /api/order                        // Criar pedido (garçom no tablet)
POST   /api/order/:id/send-to-kitchen   // Enviar para cozinha
POST   /api/order/:id/add-items         // Adicionar itens (mais pedidos)
POST   /api/order/:id/remove-item       // Remover item (com justificativa)
POST   /api/order/:id/pre-bill          // Gerar pré-conta
POST   /api/order/:id/adjust-bill       // Ajustar conta (cliente discordou)

// Mesa
GET    /api/table/:id/bill              // Conta acumulada
POST   /api/table/:id/pre-bill          // Pré-conta da mesa
POST   /api/table/:id/close             // Fechar (pagamento confirmado)
POST   /api/table/:id/close-split       // Fechar com split

// Couvert
POST   /api/table/:id/couvert           // Adicionar/remover couvert
```
