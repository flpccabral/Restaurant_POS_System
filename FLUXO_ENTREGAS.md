# FLUXO DE ENTREGAS — REALIDADE BRASILEIRA COM iFOOD

## VISÃO GERAL NO SETOR

No Brasil, o delivery de restaurante é DOMINADO pelo iFood (70%+ do mercado). Delivery próprio existe mas é minoria. A integração com iFood não é opcional — é tão essencial quanto ter telefone.

```
MERCADO DE DELIVERY NO BRASIL (2026):

  ┌────────────────────────────────────────────────────────────┐
  │  iFood — 70%+ do mercado                                  │
  │  • Dominante em todas as capitais                          │
  │  • Entregadores próprios (iFood logística ou restaurante)  │
  │  • Comissão: 12-25% por pedido                            │
  └────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────┐
  │  Rappi — ~8%                                              │
  │  • Presente em SP, RJ, BH, POA                            │
  └────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────┐
  │  Uber Eats — ~5% (em declínio)                            │
  └────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────┐
  │  Delivery PRÓPRIO — ~15%                                   │
  │  • WhatsAapp + garçom que entrega                         │
  │  • Sem taxa de comissão                                   │
  │  • Menos alcance                                           │
  └────────────────────────────────────────────────────────────┘
```

---

## 1. REALIDADE DO DELIVERY NO BRASIL

### 1.1 O restaurante típico opera com 2 canais

```
  ┌──────────────────────────────────────────────────────────────┐
  │  RESTAURANTE TÍPICO — 100 PEDIDOS/DIA                      │
  │                                                              │
  │  ┌─────────────────────┐  ┌────────────────────────┐       │
  │  │  iFood (70 pedidos) │  │  Próprio (30 pedidos)  │       │
  │  ├─────────────────────┤  ├────────────────────────┤       │
  │  │ Cliente pede app    │  │ Cliente liga ou        │       │
  │  │ iFood processa      │  │   WhatsApp             │       │
  │  │ Pedido cai no POS   │  │ Garçom anota e lança   │       │
  │  │ Cozinha prepara     │  │ Cozinha prepara        │       │
  │  │ Entregador busca    │  │ Entregador busca       │       │
  │  │ iFood gerencia      │  │ Restaurante gerencia   │       │
  │  │ Comissão: 18%       │  │ Sem comissão           │       │
  └──────────────────────┴──┴────────────────────────┘       │
  └──────────────────────────────────────────────────────────────┘
```

### 1.2 O que o POS precisa fazer com iFood

```
  iFOOD NÃO É UM CANAL DE PEDIDO QUALQUER — É O PRINCIPAL

  O POS precisa:

  RECEBER:
  ├── Pedido iFood chega no POS automaticamente
  ├── Itens mapeados (cardápio sincronizado)
  ├── Endereço + dados do cliente
  └── Status iFood: CONFIRMED

  GERENCIAR:
  ├── Cozinha prepara (igual pedido de mesa)
  ├── Tempo de preparo monitorado (iFood tem SLA)
  ├── Se atrasar: iFood penaliza o restaurante
  └── Status sincronizado com iFood (PREPARING → READY)

  FINALIZAR:
  ├── Entregador (iFood ou próprio) retira
  ├── Status: OUT_FOR_DELIVERY
  ├── Entregue: DELIVERED
  └── Comissão iFood descontada automaticamente
```

---

## 2. INTEGRAÇÃO iFOOD

### 2.1 Arquitetura

```
  ┌─────────────────────────────────────────────────────────────┐
  │                    ARQUITETURA iFOOD                        │
  │                                                             │
  │  iFood Partner API                                         │
  │  ┌─────────────────────────────────────────────────────┐   │
  │  │  Eventos (Webhook):                                │   │
  │  │  • Pedido criado → POST /ifood/webhook             │   │
  │  │  • Status alterado → POST /ifood/webhook           │   │
  │  │  • Cancelado → POST /ifood/webhook                 │   │
  │  └─────────────────────────────────────────────────────┘   │
  │                          │                                   │
  │                          ▼                                   │
  │  ┌─────────────────────────────────────────────────────┐   │
  │  │  POS Backend                                       │   │
  │  │  • Recebe webhook → cria Order                     │   │
  │  │  • Mapeia itens (categoria iFood → categoria POS)  │   │
  │  │  • Envia para KDS                                  │   │
  │  │  • Sincroniza status:                              │   │
  │  │    CONFIRMED → PREPARING → READY → OUT_FOR_DELIVERY│   │
  │  └─────────────────────────────────────────────────────┘   │
  │                          │                                   │
  │                          ▼                                   │
  │  ┌─────────────────────────────────────────────────────┐   │
  │  │  iFood Partner API (outbound)                      │   │
  │  │  • PUT /status: PREPARING                          │   │
  │  │  • PUT /status: READY                              │   │
  │  │  • PUT /status: OUT_FOR_DELIVERY                   │   │
  │  │  • PUT /status: DELIVERED                          │   │
  │  │  • PUT /cancellation-reason                        │   │
  │  └─────────────────────────────────────────────────────┘   │
  └─────────────────────────────────────────────────────────────┘
```

### 2.2 Webhook iFood

```javascript
// POST /api/integrations/ifood/webhook
// Header: x-ifood-event: ORDER_CREATED

{
  "orderId": "ifood-abc-123",
  "displayId": "1024",
  "createdAt": "2026-07-14T19:30:00Z",
  "items": [
    {
      "id": "sku-456",
      "name": "Pizza Mussarela Grande",
      "quantity": 1,
      "unitPrice": "45.00",
      "totalPrice": "45.00",
      "observations": "Sem oregano"
    }
  ],
  "total": {
    "subtotal": "45.00",
    "deliveryFee": "5.00",
    "discount": "0.00",
    "total": "50.00"
  },
  "customer": {
    "name": "João Silva",
    "phone": "11999999999"
  },
  "deliveryAddress": {
    "street": "Rua das Flores",
    "number": "123",
    "neighborhood": "Centro",
    "city": "Natal",
    "state": "RN",
    "zipCode": "59000-000",
    "reference": "Proximo ao mercado"
  },
  "payments": {
    "method": "ONLINE",
    "change": "0.00"
  },
  "preparationTime": 30,  // Minutos
  "merchantId": "merchant-xyz"
}
```

### 2.3 Mapeamento de cardápio

```
  iFood tem seu próprio catálogo (cardápio digital).
  O mapeamento iFood → POS é MANUAL:

  1. Restaurante cadastra os produtos no iFood
  2. No POS, associa o SKU do iFood ao SKU do produto
  3. Na integração, o POS usa o mapping para identificar o item

  ┌──────────────┬──────────────┬──────────────┐
  │ iFood Name   │ iFood SKU   │ POS SKU      │
  ├──────────────┼──────────────┼──────────────┤
  │ Pizza Muss. │ PZ-MUSS-G   │ PIZZA_MUSS   │
  │ Coca-Cola   │ BEB-COCA    │ COLA_350     │
  └──────────────┴──────────────┴──────────────┘

  Se item não mapeado: POS cria "Item iFood: [nome]" 
  e alerta admin para configurar.
```

### 2.4 Sincronização de status

| Estado iFood | Estado POS | Quando |
|:------------:|:----------:|--------|
| `CONFIRMED` | `pending` | Pedido chegou do iFood |
| `PREPARING` | `In Progress` | Cozinha começou (ou auto se <30min) |
| `READY` | `Ready` | Cozinha marcou pronto |
| `OUT_FOR_DELIVERY` | `out_for_delivery` | Entregador retirou |
| `DELIVERED` | `delivered` | Cliente recebeu |
| `CANCELLED` | `cancelled` | iFood cancelou (cliente desistiu) |

---

## 3. DELIVERY PRÓPRIO

### 3.1 Quando faz sentido

```
  DELIVERY PRÓPRIO É VIÁVEL QUANDO:

  • Restaurante já tem entregador fixo
  • Bairro de atuação é pequeno (3-5km)
  • Margem alta (comissão iFood de 18-25% dói)
  • Cliente fidelizado que pede direto no WhatsApp

  MISTO É O MAIS COMUM:
  • iFood: para captar clientes novos
  • Próprio: para clientes recorrentes (sem comissão)
```

### 3.2 Fluxo do delivery próprio

```
  CLIENTE LIGA / WHATSAPP
       │
       ▼
  ┌─────────────────────────────────────────┐
  │  OPERADOR NO PDV: "Delivery"            │
  │                                         │
  │  • Seleciona cliente (ou cadastra)      │
  │  • Endereço (auto-complete CEP)         │
  │  • Taxa de entrega (por bairro)         │
  │  • Pedido vai para cozinha              │
  │  • Tempo estimado exibido               │
  └─────────────────────────────────────────┘
       │
       ▼
  ┌─────────────────────────────────────────┐
  │  PEDIDO PRONTO → ENTREGADOR             │
  │                                         │
  │  • Entregador registra retirada no POS  │
  │    → status: 'out_for_delivery'         │
  │  • Entregador sai                       │
  │  • Cliente recebe → POS notificado?     │
  │    → Não (sem rastreio próprio)         │
  │    → Garçom/entregador confirma manual  │
  │    → status: 'delivered'                │
  └─────────────────────────────────────────┘
```

---

## 4. STATUS DE DELIVERY

| Estado | Descrição | Quem muda |
|--------|-----------|-----------|
| `pending` | Pedido recebido (iFood ou próprio) | Sistema |
| `preparing` | Cozinha preparando | Cozinha |
| `ready` | Pronto, aguardando entregador | Cozinha |
| `out_for_delivery` | Entregador saiu | Entregador/Caixa |
| `delivered` | Cliente recebeu | Entregador (manual) |
| `cancelled` | Cancelado | iFood ou Admin |

---

## 5. REGRAS DE NEGÓCIO — REAIS

| # | Regra |
|---|-------|
| 1 | iFood é o canal PRINCIPAL — integração é prioridade máxima |
| 2 | Pedido iFood chega com pagamento JÁ PROCESSADO (iFood recebeu) — POS não precisa cobrar |
| 3 | Comissão iFood é descontada ANTES de repassar ao restaurante (POS não precisa calcular) |
| 4 | Se iFood ficar offline, pedidos continuam chegando via webhook quando voltar |
| 5 | Delivery próprio usa pagamento no ato da entrega (dinheiro ou maquininha) |
| 6 | Taxa de entrega do próprio: configurada por bairro (não calculada por distância) |
| 7 | Entregador próprio vs iFood: o POS precisa saber quem levou (para logística) |
| 8 | Tempo de preparo é CRÍTICO no iFood — atraso penaliza o restaurante no ranking |
| 9 | Cardápio iFood e cardápio POS são SEPARADOS — sincronização é manual |

---

## 6. ENDPOINTS — REVISADOS

```javascript
// iFood
POST   /api/integrations/ifood/webhook           // Receber eventos
POST   /api/integrations/ifood/status             // Atualizar status no iFood
POST   /api/integrations/ifood/menu/sync          // Sincronizar cardápio (futuro)

// Delivery próprio
POST   /api/delivery/create                       // Criar entrega própria
GET    /api/delivery/coverage?zipCode=             // Verificar cobertura
GET    /api/delivery/calculate-fee?zipCode=&area=  // Calcular taxa

// Entregador
POST   /api/delivery/:id/out-for-delivery          // Saiu para entrega
POST   /api/delivery/:id/delivered                 // Entregue

// Rastreio (público)
GET    /api/public/delivery/:orderId/tracking       // Cliente consulta status
```
