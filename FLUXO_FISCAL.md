# FLUXO FISCAL — NFC-e, SAT, CPF NA NOTA E CONTINGÊNCIA — REALIDADE BRASILEIRA

## VISÃO GERAL NO SETOR

A obrigação fiscal no Brasil é complexa e varia por estado e porte. A maioria dos pequenos restaurantes brasileiros TERCEIRIZA a emissão fiscal para o contador ou usa sistemas simplificados. Automação completa (NFC-e automática por venda) é realidade de ~20% dos restaurantes.

```
REALIDADE FISCAL NO RESTAURANTE BRASILEIRO:

  ┌────────────────────────────────────────────────────────────┐
  │  RESTAURANTE PEQUENO (60% do mercado)                     │
  │  • Regime: Simples Nacional                               │
  │  • Emissão: Contador emite tudo no fim do mês             │
  │  • POS: SEM emissão fiscal (apenas cupom interno)         │
  │  • CPF na nota: raramente                                 │
  └────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────┐
  │  RESTAURANTE MÉDIO (30% do mercado)                       │
  │  • Regime: Simples Nacional                               │
  │  • Emissão: SAT (SP) ou NFC-e (demais estados)            │
  │  • POS: Emite NFC-e automaticamente                       │
  │  • CPF na nota: quando solicitado                         │
  │  • Usa API terceira (Focus, TecnoSpeed) para emissão     │
  └────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────┐
  │  RESTAURANTE GRANDE / REDE (10% do mercado)               │
  │  • Regime: Lucro Presumido ou Real                        │
  │  • Emissão: NFC-e + NF-e (para fornecedores)              │
  │  • POS: Emissão automática + DANFE                        │
  │  • CPF na nota: sempre que solicitado com incentivo       │
  │    ("Sorteio de prêmios" - Nota Paraná, Nota SP, etc.)    │
  │  • SAT SP obrigatório                                     │
  └────────────────────────────────────────────────────────────┘
```

---

## 1. MODALIDADES FISCAIS NO BRASIL

### 1.1 NFC-e (Nota Fiscal ao Consumidor eletrônica)

| Característica | Detalhe |
|----------------|---------|
| **Abrangência** | Todos os estados (exceto SP que usa SAT) |
| **Transmissão** | Em tempo real para SEFAZ |
| **Documento** | XML + DANFE (PDF) |
| **Prazo** | Emitir no momento da venda |
| **Cancelamento** | Até 30 min após autorização |
| **Armazenamento** | XML deve ser guardado por 5 anos |
| **Certificado** | A1 ou A3 (ICP-Brasil) |
| **Custo** | API terceira: R$ 50-200/mês |

### 1.2 SAT (Cupom Fiscal Eletrônico — SP)

| Característica | Detalhe |
|----------------|---------|
| **Abrangência** | Apenas São Paulo (obrigatório) |
| **Transmissão** | Offline — equipamento SAT gera e transmite |
| **Documento** | CFe (Cupom Fiscal Eletrônico) + extrato |
| **Equipamento** | SAT físico conectado ao POS (USB ou Ethernet) |
| **Cancelamento** | Até 30 min (via SAT) |
| **Custos** | Equipamento ~ R$ 800 (uma vez) + certificado anual |
| **Vantagem** | Sem custo mensal de API |

### 1.3 Cupom não-fiscal (para microempresas)

```
  ┌──────────────────────────────────────────────┐
  │  MICROEMPREENDEDOR (MEI)                    │
  │                                              │
  │  Se faturamento < R$ 81.000/ano:            │
  │  • Pode emitir apenas CUPOM NÃO-FISCAL       │
  │  • Sem necessidade de NFC-e                  │
  │  • Apenas relatório mensal para o contador   │
  │  • Contador emite NF-e global no fim do mês  │
  │                                              │
  │  ⚠️ Verificar legislação municipal          │
  │     Algumas cidades exigem NFC-e mesmo       │
  │     para MEI                                 │
  └──────────────────────────────────────────────┘
```

---

## 2. FLUXO DE EMISSÃO — REALISTA

### 2.1 Quando emitir

```
REGRAS FISCAIS REAIS:

  NFC-e NÃO precisa ser emitida no exato momento da venda.
  Pode ser emitida em lote no fim do dia (desde que na mesma data).

  Empresa pequena: emite NFC-e ao fim do expediente
  Empresa média: emite a cada fechamento de mesa
  Empresa grande: emite automaticamente a cada venda
```

### 2.2 Fluxo em lote (mais comum)

```
  FIM DO EXPEDIENTE — 22:00
       │
       ▼
  ┌─────────────────────────────────────────┐
  │  1. Buscar pedidos do dia               │
  │     Order.paymentStatus = 'paid'        │
  │     Order.nfce.status = 'pending'       │
  │                                         │
  │  2. Para cada pedido:                   │
  │     a) Montar XML                        │
  │     b) Associar digitalmente             │
  │     c) Transmitir via API terceira      │
  │     d) Salvar resposta                  │
  │         ├── Autorizado: salvar chave    │
  │         └── Rejeitado: log + re-tentar  │
  │                                         │
  │  3. Ao final:                           │
  │     Relatório de NFC-e emitidas         │
  │     "42 notas emitidas, 2 rejeitadas"   │
  └─────────────────────────────────────────┘
```

### 2.3 CPF na nota — incentivos estaduais

```
  ESTADOS COM PROGRAMA DE INCENTIVO:

  • Nota Paraná: sorteio de prêmios em dinheiro
  • Nota Fiscal Paulista (SP): desconto no IPVA
  • Nota Carioca (RJ): créditos
  • Nota Legal (DF): desconto em tributos
  • ... (quase todos os estados têm)

  IMPLEMENTAÇÃO:
  • Perguntar CPF é OBRIGATÓRIO? Não, é opcional
  • MAS: informar o CPF giza benefícios ao consumidor
  • POS deve perguntar: "CPF na nota?"
  • Se sim: validar CPF e incluir na NFC-e
  • Se não: emitir NFC-e sem CPF (consumidor não identificado)
```

---

## 3. ESTRATÉGIA DE IMPLEMENTAÇÃO

### 3.1 Por fase

```
  FASE 1 — Cupom não-fiscal (MVP, 0 custo)
  ─────────────────────────────────────
  • POS gera CUPOM INTERNO (sem validade fiscal)
  • Contador emite NF-e global no fim do mês
  • ✅ Legal para MEI
  • ✅ Zero custo
  • ❌ Não vale para empresas maiores

  FASE 2 — API terceira (mês 3)
  ─────────────────────────────────────
  • Integrar com Focus NFe ou TecnoSpeed
  • Emissão em lote (fim do dia)
  • Custo: ~R$ 100-200/mês
  • ✅ Atende restaurante médio
  • ✅ Suporte completo SEFAZ

  FASE 3 — SAT SP (mês 6, apenas SP)
  ─────────────────────────────────────
  • Integrar com equipamento SAT
  • Emissão em tempo real
  • Custo: R$ 800 (SAT) + R$ 200/ano certificado
  • ✅ Substitui API terceira em SP
```

### 3.2 APIs disponíveis no mercado

| API | Custo | NFC-e | SAT | Suporte | Facilidade |
|-----|:-----:|:-----:|:---:|:-------:|:----------:|
| **Focus NFe** | R$ 89/mês | ✅ | ✅ | Ótimo | Alta |
| **TecnoSpeed** | R$ 129/mês | ✅ | ❌ | Bom | Média |
| **Webmania** | R$ 49/mês | ✅ | ❌ | Regular | Alta |
| **Acras** | R$ 99/mês | ✅ | ❌ | Bom | Média |

---

## 4. REGRAS DE NEGÓCIO FISCAIS — REAIS

| # | Regra |
|---|-------|
| 1 | NFC-e pode ser emitida em LOTE no fim do dia (não precisa ser online na hora) |
| 2 | MEI pode operar sem NFC-e (cupom não-fiscal + contador) |
| 3 | CPF na nota é OPCIONAL — nunca travar a venda |
| 4 | Cancelamento fiscal: 30 min após emissão (qualquer motivo) |
| 5 | Após 30 min: não cancela — precisa de NF-e de devolução (contador) |
| 6 | SAT SP é obrigatório em SP — mas implementação é cara |
| 7 | Para MVP (qualquer estado): API Focus NFe (menor custo-benefício) |
| 8 | Certificado digital A1: R$ 200-300/ano |
| 9 | XML deve ser armazenado por 5 anos (nuvem + backup) |
| 10 | Contingência: se SEFAZ cair, emitir em lote quando voltar |

---

## 5. MODELO DE DADOS — REVISADO

```javascript
// Configuração fiscal da loja (realista):
{
  fiscal: {
    // Obrigatórios para emitir NFC-e
    cnpj: String,
    ie: String,
    crt: Number,         // 1=SN, 2=SN excesso, 3=LP/LR

    // NFC-e
    nfce: {
      enabled: Boolean,   // true se loja tem CNPJ + certificado
      environment: String,// homologacao | producao
      series: Number,
      apiProvider: String // focus | tecnospeed | webmania | null
    },

    // SAT (SP)
    sat: {
      enabled: Boolean,
      model: String,     // SAT model
      cnpj: String,      // CNPJ do estabelecimento
      assinacao: String  // Chave de assinatura do SAT
    },

    // CPF na nota
      cpfPrompt: Boolean, // Perguntar CPF? (default: true)

    // Cupom não-fiscal (MEI)
    internalReceipt: {
      enabled: Boolean,   // true se não tem certificado
      headerText: String, // "Obrigado pela preferência!"
      showCnpj: Boolean   // Mostrar CNPJ no rodapé?
    }
  }
}
```

---

## 6. ENDPOINTS — REVISADOS

```javascript
// Emissão
POST   /api/fiscal/emit-batch            // Emitir lote de NFC-e (fim do dia)
       Body: { storeId, orderIds: [...] }
       Res:  { emitted: 42, failed: 2, errors: [...] }

POST   /api/fiscal/emit-single/:orderId  // Emitir nota de um pedido específico

POST   /api/fiscal/cancel/:orderId       // Cancelar (30 min)
       Body: { justification: "..." }

// Configuração
GET    /api/store/:id/fiscal-config
PUT    /api/store/:id/fiscal-config

// Relatórios
GET    /api/reports/fiscal/daily?date=&storeId=     // Resumo do dia
GET    /api/reports/fiscal/pending?storeId=         // Pendentes de emissão
GET    /api/reports/fiscal/failed?storeId=          // Rejeitadas

// Cupom não-fiscal (MVP)
GET    /api/order/:id/receipt                      // Cupom interno (PDF/HTML)
```
