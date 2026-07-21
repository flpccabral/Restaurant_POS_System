# FLUXO DE ESTOQUE — REALIDADE DE RESTAURANTE BRASILEIRO

## VISÃO GERAL NO SETOR

O estoque no restaurante brasileiro real é GERIDO PELO CHEF, não pelo sistema. A maioria (~80%) dos pequenos restaurantes não tem ficha técnica, não calcula CMV, não sabe o custo exato de cada prato. O controle real é:

- **O que entra:** Nota fiscal do fornecedor → conferência manual → geladeira
- **O que sai:** Cozinheiro pega ingrediente → prepara → pronto → vende
- **O que falta:** "Chef, acabou o tomate!" → anota na lista de compras

O sistema NÃO deve tentar substituir o chef — deve DAR VISIBILIDADE para o dono.

```
  REALIDADE DA GESTÃO DE ESTOQUE NO BRASIL:

  RESTAURANTE PEQUENO (70%):
  • Chef faz compras toda semana no CEASA/Atacadão
  • Nota fiscal da compra → guarda para o contador
  • Sem controle de saída por item
  • "Acabou? Compra de novo"
  • Não sabe o CMV — só sabe se lucrou no fim do mês

  RESTAURANTE MÉDIO (20%):
  • Fornecedores fixos (carne, verdura, frios)
  • Compra semanal com base no consumo percebido
  • Faz inventário mensal (conta tudo que tem)
  • Sabe o CMV aproximado (pelo balanço mensal)
  • USA planilha Excel — não usa sistema

  RESTAURANTE GRANDE / REDE (10%):
  • Ficha técnica de cada prato (custo calculado)
  • Inventário semanal ou diário
  • Compra baseada em consumo histórico + previsão
  • CMV monitorado semanalmente
  • USA sistema de estoque integrado ao PDV
```

---

## 1. O QUE FAZ SENTIDO IMPLEMENTAR

### 1.1 Controle mínimo (MVP) — para 100% dos restaurantes

```
  ┌─────────────────────────────────────────────────────────┐
  │  CONTROLE MÍNIMO — ÚTIL PARA QUALQUER RESTAURANTE      │
  │                                                         │
  │  ✅ ENTRADA: Registrar compras                           │
  │     • Fornecedor + ingrediente + qtd + valor            │
  │     • Nota fiscal da compra (opcional)                  │
  │     • Custo médio ponderado calculado automaticamente   │
  │                                                         │
  │  ✅ INVENTÁRIO: Contagem periódica                      │
  │     • Inventário mensal (ou semanal)                    │
  │     • Sistema calcula: o que DEVERIA ter vs o que TEM   │
  │     • Diferença = perda/desvio/erro                     │
  │                                                         │
  │  ✅ RELATÓRIO: CMV aproximado                           │
  │     • Custo = (estoque inicial + compras - estoque final)│
  │     • CMV = custo / receita * 100                       │
  │     • "Seu CMV foi de 38% este mês"                     │
  │     • "Isso é R$ 15.000 que saiu do seu bolso"          │
  └─────────────────────────────────────────────────────────┘
```

### 1.2 Controle avançado — só para restaurantes que QUEREM

```
  ┌─────────────────────────────────────────────────────────┐
  │  CONTROLE AVANÇADO — VALIOSO, MAS POUCOS USAM           │
  │                                                         │
  │  ✅ FICHA TÉCNICA (Recipe)                               │
  │     • Quantos gramas de tomate vão no Filé c/ Fritas   │
  │     • Custo do prato = soma dos ingredientes + 10% perda│
  │     • Margem de contribuição por prato                  │
  │     • Só faz sentido se o restaurante TEM BALANÇA      │
  │       (a maioria não pesa ingrediente por porção)       │
  │                                                         │
  │  ✅ BAIXA AUTOMÁTICA POR VENDA                           │
  │     • Cada venda baixa os ingredientes automaticamente  │
  │     • Só funciona se TODOS os produtos têm ficha técnica │
  │     • Se não tem ficha, a baixa não acontece            │
  │                                                         │
  │  ✅ PREVISÃO DE COMPRA                                   │
  │     • Baseado no consumo histórico                      │
  │     • Sugere quantidades para próxima compra            │
  └─────────────────────────────────────────────────────────┘
```

---

## 2. FLUXO REAL DE COMPRAS

### 2.1 Como o restaurante compra

```
  ┌──────────────────────────────────────────────────────────┐
  │  FLUXO DE COMPRAS — RESTAURANTE TÍPICO                  │
  │                                                          │
  │  SEGUNDA-FEIRA, 07:00                                    │
  │  Chef vai ao CEASA (ou recebe fornecedor)                │
  │                                                          │
  │  Na cabeça do chef:                                      │
  │  "Essa semana vai ser mais movimentada"                  │
  │  "Filé mignon: 10kg (consumo: 8kg + margem)"            │
  │  "Tomate: 2 caixas"                                      │
  │  "Cebola: 5kg"                                           │
  │  "Sal: tem bastante ainda"                               │
  │                                                          │
  │  Compra:                                                 │
  │  • Filé mignon 10kg × R$ 45,00 = R$ 450,00             │
  │  • Tomate 2 cx × R$ 35,00 = R$ 70,00                   │
  │  • Cebola 5kg × R$ 4,00 = R$ 20,00                     │
  │  • Batata 10kg × R$ 6,00 = R$ 60,00                    │
  │  TOTAL: R$ 600,00                                       │
  │                                                          │
  │  Chef volta, guarda tudo, joga a nota no balcão         │
  │  (ou entrega para o dono/escritório)                    │
  └──────────────────────────────────────────────────────────┘
```

### 2.2 O que o sistema deve fazer

```
  O SISTEMA NÃO SUBSTITUI A INTUIÇÃO DO CHEF — ela é insubstituível

  O sistema DEVE:
  ├── Registrar a compra (nota fiscal ou manual)
  ├── Acumular histórico de consumo
  ├── Mostrar tendências: "Nas últimas 4 semanas, consumo de filé subiu 12%"
  ├── Sugerir compra baseada em histórico: "Semana passada você comprou 10kg"
  └── Alertar: "Você comprou 10kg de filé mas consumiu apenas 6kg — talvez tenha estoque parado"

  O sistema NÃO DEVE:
  ├── Travar venda por falta de estoque (100% dos restaurantes odeiam isso)
  ├── Exigir ficha técnica para operar (80% não tem)
  └── Fazer baixa automática sem validação (se errar a ficha, o estoque fica errado)
```

---

## 3. INVENTÁRIO — A ÚNICA MÉTRICA CONFIÁVEL

### 3.1 Por que inventário é mais importante que baixa automática

```
  BAIXA AUTOMÁTICA (ficha técnica):
  ├── Assume que cada porção tem EXATAMENTE 250g de filé
  ├── Mas na prática: cozinheiro coloca "mais ou menos"
  ├── Erro de 10g por porção × 100 porções = 1kg de diferença
  └→ Estoque vai ficando ERRADO com o tempo

  INVENTÁRIO (contagem física):
  ├── "Vamos contar tudo que tem na cozinha"
  ├── Compara com o que o sistema acha que tem
  ├── Diferença = perda real (ou roubo, ou erro)
  └→ Corrige o estoque e mostra o desperdício real
```

### 3.2 Fluxo de inventário

```
  ┌─────────────────────────────────────────────────────────┐
  │  INVENTÁRIO MENSAL                                     │
  │                                                         │
  │  Fim do mês, após o fechamento:                        │
  │                                                         │
  │  1. Gerar planilha de contagem                          │
  │     • Lista de todos os ingredientes com saldo atual    │
  │     • Coluna "Saldo no sistema" preenchida              │
  │     • Coluna "Saldo real" em branco                     │
  │                                                         │
  │  2. Imprimir (ou abrir no tablet)                      │
  │     • Chef + cozinheiro contam fisicamente              │
  │     • "Tomate: tem 2 caixas e meia" → 2.5              │
  │     • "Filé mignon: tem 3 peças de ~1kg cada" → 3kg    │
  │                                                         │
  │  3. Inserir no sistema                                  │
  │     • Chef ou dono digita os valores reais              │
  │     • Sistema calcula diferença                         │
  │                                                         │
  │  4. Resultado:                                          │
  │     ┌────────────┬──────┬──────┬──────┬──────┐        │
  │     │ Ingrediente│Sistema│ Real  │ Dif  │ %    │        │
  │     ├────────────┼──────┼──────┼──────┼──────┤        │
  │     │ Filé       │ 8kg  │ 7.2kg│-0.8kg│ -10% │        │
  │     │ Tomate     │ 15kg │14.5kg│-0.5kg│ -3%  │        │
  │     │ Cebola     │ 5kg  │ 5kg  │  0   │  0%  │        │
  │     └────────────┴──────┴──────┴──────┴──────┘        │
  │                                                         │
  │  5. CMV REAL:                                           │
  │     (estoque_inicial + compras - estoque_final) / receita│
  │     = (R$ 5.000 + R$ 12.000 - R$ 4.200) / R$ 35.000    │
  │     = 36,6%                                             │
  └─────────────────────────────────────────────────────────┘
```

---

## 4. FICHA TÉCNICA — PARA QUEM QUER

### 4.1 Implementação (para o restaurante que quer usar)

```
  ┌─────────────────────────────────────────────────────────┐
  │  FICHA TÉCNICA — QUANDO O RESTAURANTE QUER CONTROLAR   │
  │                                                         │
  │  Chef pesa UMA VEZ os ingredientes de cada prato:      │
  │                                                         │
  │  FILÉ COM FRITAS:                                       │
  │  • Filé mignon: 200g → R$ 9,00                         │
  │  • Batata: 150g → R$ 0,90                               │
  │  • Sal: 3g → R$ 0,02                                    │
  │  • Óleo: 20ml → R$ 0,30                                 │
  │  • Alface: 30g → R$ 0,30                                │
  │  • Tomate: 50g → R$ 0,50                                │
  │  ─────────────────────────────────                     │
  │  Custo ingredientes: R$ 11,02                           │
  │  10% perda: R$ 1,10                                     │
  │  Custo total: R$ 12,12                                  │
  │  Preço de venda: R$ 35,00                               │
  │  Margem: 65,4%                                          │
  │                                                         │
  │  Chef cadastra UMA VEZ no sistema                       │
  │  Sistema calcula automaticamente o custo de cada venda   │
  └─────────────────────────────────────────────────────────┘
```

### 4.2 Limitação real

```
  FICHA TÉCNICA SÓ FUNCIONA SE:

  ✅ Chef tem balança e pesa os ingredientes
  ✅ Porções são padronizadas (mesmo tamanho sempre)
  ✅ Cozinheiro segue a ficha (não coloca "mais um pouco")
  ✅ Ingredientes são consistentes (mesmo fornecedor)

  NA PRÁTICA:
  80% dos restaurantes brasileiros NÃO fazem isso.
  A ficha técnica é um OBJETIVO, não um pré-requisito.
```

---

## 5. TRÊS NÍVEIS DE IMPLEMENTAÇÃO

```
  NÍVEL 1 — ESTOQUE BÁSICO (MVP, 100% dos restaurantes)
  ───────────────────────────────────────────────────
  • Registrar compras (entrada manual)
  • Custo médio automático
  • Inventário mensal (contagem física)
  • Relatório CMV (pelo inventário)
  • Sugestão de compra (baseada em histórico)
  • ✅ Sem ficha técnica, sem baixa automática

  NÍVEL 2 — FICHA TÉCNICA (20% dos restaurantes)
  ───────────────────────────────────────────────────
  • Cadastro de recipes
  • Custo por prato (calculado)
  • Baixa automática APENAS se recipe existe
  • Alertas de estoque baixo
  • ✅ Restaurante precisa ter balança + padronização

  NÍVEL 3 — GESTÃO COMPLETA (5% dos restaurantes)
  ───────────────────────────────────────────────────
  • Tudo do Nível 2
  • Ordens de compra automáticas
  • Previsão de demanda (ML)
  • Transferências entre lojas
  • Curva ABC de ingredientes
  • ✅ Rede/restaurantes grandes
```

---

## 6. REGRAS DE NEGÓCIO — REAIS

| # | Regra |
|---|-------|
| 1 | NUNCA travar venda por falta de estoque — restaurante REAL não opera assim |
| 2 | Ficha técnica é OPCIONAL — 80% dos restaurantes não usa |
| 3 | Baixa automática só funciona se TODOS os produtos têm recipe (senão, não baixa) |
| 4 | Inventário físico é a ÚNICA fonte da verdade — sempre sobrescreve o calculado |
| 5 | CMV calculado por inventário é mais confiável que CMV por baixa automática |
| 6 | Perda na cozinha é REAL e esperada — 5-15% é normal |
| 7 | Sugestão de compra é baseada em HISTÓRICO, não em recipe |
| 8 | Fornecedor pode ter preço diferente por entrega — registrar sempre o custo real |
| 9 | Ingrediente perecível (verduras, carnes) tem validade — alertar antes de vencer |
| 10 | Estoque mínimo é INFORMATIVO — não bloqueia nada |

---

## 7. ENDPOINTS — REVISADOS

```javascript
// Compras (entrada manual)
POST   /api/stock/purchase           // Registrar compra
       Body: { supplier, items: [{ ingredient, qty, unitCost }], invoice }

// Inventário
POST   /api/stock/inventory          // Registrar contagem física
       Body: { items: [{ ingredient, actualQty }] }
GET    /api/stock/inventory/diff     // Ver diferenças da última contagem

// Consultas
GET    /api/stock/balance            // Saldo atual
GET    /api/stock/history            // Histórico de movimentos
GET    /api/stock/consumption        // Consumo por período

// CMV
GET    /api/reports/cmv?period=      // CMV por período (inventário)
GET    /api/reports/cmv/detail       // CMV detalhado por categoria

// Sugestão de compra
GET    /api/stock/purchase-suggest   // Sugerir compra baseada em histórico

// Ficha técnica (Nível 2+)
GET    /api/recipe
POST   /api/recipe
```
