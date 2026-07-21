# FLUXO DE PAGAMENTO — SISTEMAS BRASILEIROS REAIS

## VISÃO GERAL NO SETOR

No restaurante brasileiro real, o pagamento é **descentralizado**. O garçom leva a maquininha na mesa (Stone, Cielo, Rede, GetNet), o cliente aproxima o cartão ou lê o QR Code PIX na comanda. **Gateway online (Mercado Pago API) é exceção, não regra.** A maioria dos restaurantes opera com:

| Realidade brasileira | Como funciona |
|----------------------|---------------|
| **Maquininha física** | Garçom leva Stone/Cielo na mesa. Sistema NÃO controla o pagamento — apenas REGISTRA o resultado |
| **PIX na maquininha** | Maquininha gera QR Code. Cliente paga. Maquininha confirma. Garçom digita no sistema |
| **PIX por QR Code do sistema** | Sistema gera QR Code Mercado Pago/Efí. Cliente escaneia. Webhook confirma |
| **Dinheiro** | Garçom recebe, leva ao caixa. Caixa registra no sistema |
| **TEF (Transferência Eletrônica de Fundos)** | Software de caixa integrado à maquininha via TEF — o pagamento é processado DENTRO do sistema POS |

---

## 1. MÉTODOS DE PAGAMENTO NO BRASIL

### 1.1 Classificação real

| Método | % Mercado¹ | Tipo | Processamento | Fluxo no POS |
|--------|:----------:|:----:|:--------------|--------------|
| **Cartão débito** | ~25% | Eletrônico | Maquininha / TEF | POS registra resultado |
| **Cartão crédito** | ~30% | Eletrônico | Maquininha / TEF | POS registra resultado |
| **PIX** | ~35% | Eletrônico | QR Code (sistema ou maquininha) | Webhook ou confirmação manual |
| **Dinheiro** | ~8% | Físico | Caixa | POS registra |
| **Vale-refeição** (VR/VT) | ~2% | Eletrônico | Maquininha própria (Alelo, Sodexo, Ticket) | POS registra resultado |

¹ Estimativa 2026 para restaurantes — fonte: ABRASEL, Febraban

### 1.2 A maquininha é o centro

```
REALIDADE DO RESTAURANTE BRASILEIRO TÍPICO:

                             ┌───────────────────┐
                             │   MAQUININHA      │
                             │  (Stone/Cielo)    │
                             └────────┬──────────┘
                                      │
           ┌──────────┬───────────────┼───────────────┬──────────┐
           │          │               │               │          │
           ▼          ▼               ▼               ▼          ▼
     ┌────────┐ ┌────────┐   ┌────────────┐   ┌──────────┐ ┌────────┐
     │Débito  │ │Crédito │   │   PIX      │   │Voucher   │ │  QR    │
     │(aproxim│ │(chip)  │   │(QR estático│   │(Alelo)   │ │Code    │
     │ )      │ │        │   │ ou dinâm.) │   │          │ │PIX     │
     └────────┘ └────────┘   └────────────┘   └──────────┘ └────────┘
          │          │              │               │           │
          └──────────┴──────────────┴───────────────┴───────────┘
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │  GARÇOM / CAIXA      │
                          │  "Confirmo que o     │
                          │  pagamento foi       │
                          │  recebido"           │
                          │  (digita no POS)     │
                          └──────────────────────┘
```

---

## 2. FLUXOS DE PAGAMENTO REAIS

### 2.1 Pagamento com maquininha (80% dos casos)

```
  GARÇOM LEVA MAQUININHA NA MESA
       │
       ├── Cliente insere/aproxima o cartão
       │   └── Maquininha processa (independente do POS)
       │
       ├── Cliente lê QR Code PIX na maquininha
       │   └── Maquininha confirma (independente do POS)
       │
       └── Cliente paga em dinheiro
           └── Garçom recebe e leva ao caixa
               
       ▼
  ┌─────────────────────────────────────────┐
  │  GARÇOM VOLTA AO PDV                    │
  │                                         │
  │  No sistema POS:                        │
  │  • Clica no pedido                     │
  │  • Clica "Registrar Pagamento"         │
  │  • Seleciona método:                   │
  │    ┌─ Dinheiro ──┐                     │
  │    │  Cartão     │ ← sem detalhes      │
  │    │  PIX        │   da operadora,     │
  │    │  VR/Alelo   │   apenas o método   │
  │    └─────────────┘                     │
  │  • Digita o valor                      │
  │  • Sistema registra:                   │
  │    Order.paymentStatus = 'paid'        │
  │    Order.paymentMethod = 'Credito'     │
  │    Order.payment.operator = 'stone'    │
  │    (operador da maquininha é opcional) │
  │  • Caixa registra transação            │
  └─────────────────────────────────────────┘
```

### 2.2 TEF (Integração com a maquininha) — Futuro

```
  TEF é a evolução: o POS conversa DIRETAMENTE com a maquininha

  POS → TEF Client → Maquininha → Bandeira → TEF Client → POS
  
  1. Garçom clica "Pagar com Cartão" no POS
  2. POS envia { valor, tipo } para TEF
  3. TEF abre comunicação serial com a maquininha
  4. Maquininha processa (chip/senha/aproximação)
  5. TEF retorna { autorizado, NSU, bandeira, parcelas }
  6. POS registra automaticamente

  Realidade: TEF é padrão em redes (Bob's, McDonald's)
  Pequenos restaurantes: ~10% usam TEF (mas crescendo)
```

### 2.3 PIX via sistema (gateway online)

```
  ┌─────────────────────────────────────────┐
  │  FLUXO PIX — QUANDO O SISTEMA GERA QR  │
  │                                         │
  │  Usado quando:                          │
  │  • Delivery (cliente paga pelo link)    │
  │  • Balcão sem maquininha                │
  │  • Cliente quer pagar pelo app do banco │
  │    (em vez de aproximar o cartão)       │
  └─────────────────────────────────────────┘

  SISTEMA → API Mercado Pago / Efí / OpenPix
       │
       ├── Gera QR Code dinâmico (valor fixo)
       ├── Gera código copia-e-cola
       ├── Exibe na tela do PDV (ou envia link)
       │
       └── Aguarda webhook (até 30 min)
            ├── Confirmado → marca pago
            └── Expirado → cancela QR, pedido volta 'unpaid'
```

### 2.4 Pagamento misto (realidade brasileira)

```
  CONTA DE R$ 85,00 — PAGAMENTO MISTO TÍPICO:

  "Parte em dinheiro, parte no cartão"

  1. Garçom registra no POS:
     Pagamento 1: Dinheiro — R$ 35,00
     Pagamento 2: Crédito — R$ 50,00 (1x)

  2. Maquininha processa R$ 50,00
  3. Cliente entrega R$ 35,00 em espécie
  4. Garçom confirma no POS
  5. Sistema fecha a conta

  ⚠️ O POS NÃO controla o processamento da maquininha
     — só REGISTRA o que o garçom informou
```

---

## 3. SPLIT DE CONTA NO BRASIL

### 3.1 Realidade do split

```
  GRUPO DE 4 PESSOAS — CONTA DE R$ 200,00

  Cada um paga seu consumo + rateio do couvert/10%

  ┌──────┬────────────┬──────────┬────────┬──────┐
  │Pessoa│ Consumiu   │ Rateio   │ Total  │ Paga │
  ├──────┼────────────┼──────────┼────────┼──────┤
  │João  │ Filé R$45  │ 10% R$2  │ R$ 47  │ Pix  │
  │Maria │ Salada R$25│ 10% R$2  │ R$ 27  │Pix   │
  │Pedro │ Pizza R$55 │ 10% R$2  │ R$ 57  │Cartão│
  │Ana   │ Massa R$65 │ 10% R$2  │ R$ 67  │Dinh. │
  │      │ + refri    │          │        │      │
  │      │ R$10       │          │        │      │
  ├──────┼────────────┼──────────┼────────┼──────┤
  │Total │ R$200,00   │ R$8,00   │R$208   │      │
  └──────┴────────────┴──────────┴────────┴──────┘

  10% é OPCIONAL por lei, mas na prática:
  • Se um não quer pagar, os outros pagam
  • Se todos recusam, tira da conta (raro)
```

### 3.2 Fluxo de split no PDV

```
  GARÇOM: "Vou dividir a conta"
       │
       ▼
  ┌─────────────────────────────────────────┐
  │  TELA DE SPLIT — REAL                  │
  │                                         │
  │  CONTA MESA 5 — R$ 208,00 (c/ 10%)    │
  │                                         │
  │  ┌─ DIVIDIR IGUAL ───────────────────┐ │
  │  │  4 pessoas → R$ 52,00 cada       │ │
  │  │  [Confirmar]                      │ │
  │  └───────────────────────────────────┘ │
  │                                         │
  │  ┌─ DIVIDIR POR ITENS ──────────────┐ │
  │  │  Selecione os itens de cada      │ │
  │  │  pessoa abaixo. O 10% é rateado  │ │
  │  │  proporcionalmente.              │ │
  │  │                                  │ │
  │  │  João: [ ] Filé R$45 [ ] Refri  │ │
  │  │  Maria: [ ] Salada              │ │
  │  │  Pedro: [ ] Pizza               │ │
  │  │  Ana: [ ] Massa [ ] Refri       │ │
  │  └──────────────────────────────────┘ │
  │                                         │
  │  ┌─ CONFIRMAR ────┐ ┌─ VOLTAR ──┐    │
  │  │  (envia para   │ │           │    │
  │  │   caixa pagar) │ │           │    │
  │  └────────────────┘ └───────────┘    │
  └─────────────────────────────────────────┘
```

---

## 4. MAQUININHAS NO BRASIL

### 4.1 Principais operadoras

| Operadora | % mercado¹ | Modelos comuns | TEF? | PIX na máquina? |
|-----------|:----------:|----------------|:----:|:---------------:|
| **Stone** | ~30% | Stone 2, Smart | ✅ | ✅ |
| **Cielo** | ~28% | Cielo LIO, Cielo Flash | ✅ | ✅ |
| **Rede** (Itaú) | ~20% | Rede R02, R03, R04 | ✅ | ✅ |
| **GetNet** (Santander) | ~12% | GetNet Smart | ✅ | ✅ |
| **PagSeguro** | ~8% | Moderninha | ❌ (proprietário) | ✅ |
| **Mercado Pago** | ~2% | Point | ✅ | ✅ |

¹ Estimativa 2026

### 4.2 Como o POS se integra

| Nível | Descrição | Complexidade | Adoção |
|:-----:|-----------|:------------:|:------:|
| **0 — Manual** | Garçom digita resultado da maquininha no POS | Nula | ~70% dos restaurantes |
| **1 — TEF Dial** | POS conversa com maquininha via modem discado | Média | ~15% |
| **2 — TEF IP** | POS conversa com maquininha via rede/API | Alta | ~12% |
| **3 — SDK integrado** | POS embarca SDK da operadora | Muito alta | ~3% |

### 4.3 Recomendação para implementação

```
  FASE 1 (MVP): Nível 0 — Manual
  ─────────────────────────────────
  Garçom finaliza pagamento na maquininha
  Volta ao POS e clica "Confirmar Pagamento"
  POS registra: método + valor
  SEM integração com a máquina

  FASE 2 (6 meses): TEF IP com app de parceiro
  ─────────────────────────────────
  APIs TEF da Stone/Cielo
  POS envia valor, recebe resultado
  Suporte a PIX + cartão

  FASE 3 (12 meses): Multi-operadora
  ─────────────────────────────────
  Suporte a Stone + Cielo + Rede
  Auto-detect da maquininha conectada
```

---

## 5. PIX — IMPLEMENTAÇÃO BRASILEIRA REAL

### 5.1 Três formas de implementar PIX

```
  ┌──────────────────────────────────────────────────────────┐
  │  OPÇÃO A — QR Code estático (mais comum)                 │
  │  • Chave PIX fixa da loja (CNPJ ou CPF)                 │
  │  • POS ou sistema gera QR da chave (mesmo valor sempre) │
  │  • Cliente escaneia, paga, avisa o garçom                │
  │  • Garçom CONFIRMA MANUALMENTE no POS                    │
  │  • ❌ Sem confirmação automática                         │
  │  • ✅ Mais barato (sem gateway)                          │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  OPÇÃO B — QR Code dinâmico com gateway                  │
  │  • API Mercado Pago / OpenPix / Efí                      │
  │  • Sistema gera QR com valor exato + identificação       │
  │  • Webhook confirma automaticamente                      │
  │  • ✅ Confirmação automática                             │
  │  • ❌ Custo de gateway (~0,99% por transação PIX)       │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  OPÇÃO C — Link de pagamento (delivery)                  │
  │  • Sistema gera link PIX (ex: mercadopago.com/pay/xxx)   │
  │  • Envia por WhatsApp ao cliente                         │
  │  • Cliente clica, paga no app do banco                   │
  │  • Webhook confirma                                      │
  │  • ✅ Ideal para delivery                                │
  └──────────────────────────────────────────────────────────┘
```

### 5.2 Recomendação

```
  Para restaurante pequeno/médio (MVP):
  ├── Cartão: maquininha (nível 0 — manual)
  ├── PIX: QR estático com confirmação manual
  └── Delivery: link PIX via Mercado Pago (automático)

  Para restaurante grande / rede:
  ├── Cartão: TEF IP (Stone/Cielo)
  ├── PIX: QR dinâmico OpenPix (taxa menor que MP)
  └── Delivery: link PIX OpenPix
```

---

## 6. MODELO DE DADOS — PAGAMENTO (REVISADO)

```javascript
// Pagamento no Order — modelo realista:
{
  payment: {
    // Pagamentos podem ser MÚLTIPLOS (pagamento misto)
    transactions: [{
      method: String,           // Dinheiro | Pix | Debito | Credito | Voucher
      value: Number,            // Valor pago nesta transação
      installments: Number,     // Parcelas (só crédito)
      machineOperator: String,  // stone | cielo | rede | getnet | pagseguro |
                                // mercado_pago | null (dinheiro)
      machineNsu: String,       // NSU da transação na maquininha (opcional)
      authorizationCode: String,// Código de autorização
      status: String,           // approved | manual_confirmation | pending
      confirmedBy: ObjectId,    // Quem confirmou o pagamento
      confirmedAt: Date,

      // PIX
      pix: {
        type: String,           // estatico | dinamico
        qrCode: String,         // copia-e-cola
        qrCodeBase64: String,
        expiresAt: Date,
        endToEndId: String,     // ID da transação PIX no Banco Central
        gatewayPaymentId: String // ID no gateway (se dinâmico)
      },

      // Split
      personName: String,       // Nome da pessoa (se split)
      items: [ObjectId],        // Itens que esta pessoa pagou (se split por item)
    }],

    paymentStatus: String,      // unpaid | partially_paid | paid | refunded
    totalPaid: Number,          // Soma de todas as transactions
    change: Number,             // Troco (se pagamento em dinheiro > total)
    paymentDate: Date
  }
}
```

---

## 7. REGRAS DE NEGÓCIO — REAIS

| # | Regra | Base |
|---|-------|------|
| 1 | Maquininha é INDEPENDENTE do POS — POS apenas REGISTRA o resultado | Prática do setor |
| 2 | Pagamento misto é REGRA, não exceção (parte em cada método) | Cultura brasileira |
| 3 | Garçom CONFIRMA o pagamento manualmente (nível 0) no POS | 70% dos restaurantes |
| 4 | 10% é calculado sobre o subtotal, dividido proporcionalmente no split | Lei + prática |
| 5 | PIX estático com confirmação manual é o padrão para pequenos restaurantes | Prática do setor |
| 6 | PIX dinâmico só é necessário para delivery e automação | Prática do setor |
| 7 | Split não cria transações separadas na maquininha — uma pessoa paga o total e acerta com o grupo | Cultura brasileira |
| 8 | Troco (dinheiro) é registrado como transação negativa separada | Prática contábil |
| 9 | Voucher (VR) precisa de CNPJ do estabelecimento na maquininha | Regra das operadoras |
| 10 | NFC-e é emitida COM ou SEM pagamento — pagamento não condiciona a nota (são independentes) | Legislação |

---

## 8. ENDPOINTS — REVISADOS

```javascript
// Registro de pagamento manual (fluxo real)
POST   /api/order/:id/payment/register
       Body: {
         transactions: [{
           method: "Credito",
           value: 150.00,
           installments: 3,
           machineOperator: "stone",
           machineNsu: "123456",
           personName: "João"       // Se split
         }]
       }

// Pagamento com gateway (PIX dinâmico / delivery)
POST   /api/payment/gateway/pix
       Body: { orderId, amount }
POST   /api/payment/gateway/card
       Body: { orderId, amount, installments }

// Webhook
POST   /api/webhooks/mercadopago
POST   /api/webhooks/openpix
POST   /api/webhooks/stone

// Fechamento
POST   /api/table/:id/close         // Pagamento único
POST   /api/table/:id/close-split   // Split
```
