---
name: pos-validacao-e-qa
description: >-
  Use quando precisar executar testes, entender a cobertura de testes atual,
  validar alterações antes de submeter PRs ou criar novos testes automatizados.
  Esta skill detalha como a suíte de testes funciona, a lacuna de cobertura existente,
  como utilizar o `mongodb-memory-server` em testes de integração e a execução do
  script de verificação unificado `verify.sh`.
---

# Validação e QA — Restaurant POS System

## Quando usar

- Executar testes automatizados do backend ou frontend
- Criar novos arquivos de teste Jest
- Entender quais módulos possuem cobertura de testes
- Executar a verificação local completa antes de fazer commit (`verify.sh`)
- Diagnosticar falhas na suíte de testes

## Quando não usar

- Configuração inicial de ambiente de desenvolvimento (→ `pos-build-e-ambiente`)
- Depuração de incidentes em produção sem foco em automação de testes (→ `pos-playbook-de-depuracao`)

---

## Estado atual da suíte de testes

### Cobertura real (verificada em 2026-07-20)

- **Arquivo de teste ativo:** `pos-backend/tests/phase8-pdv-models.test.js` (19 testes de integração cobrindo `CashSession` e `Payment`).
- **Scripts em `package.json`:** `test:phase1` a `test:phase7` referenciam arquivos não existentes no repositório.
- **Isolamento de Banco:** Testes utilizam `mongodb-memory-server` configurado via Jest. Nenhum teste deve depender de um banco de dados MongoDB em execução física.

---

## Execução de Testes

### 1. Executar todos os testes de backend

```bash
cd pos-backend
npm test
```

### 2. Executar testes em modo watch (desenvolvimento)

```bash
cd pos-backend
npm run test:watch
```

### 3. Executar o script de verificação unificada (`verify.sh`)

```bash
cd pos-backend
bash scripts/verify.sh
```

O script `verify.sh` realiza 10 verificações:
1. Pré-requisitos (Node >= 18, npm)
2. Presença de arquivos obrigatórios
3. Validação de `.env` e chaves sensíveis
4. Varredura por segredos hardcoded no código fonte
5. Verificação de `node_modules`
6. Teste de import sem falha (`require('./app.js')`)
7. Execução do Jest (`npm test`)
8. Mapeamento de scripts do `package.json`
9. Existência dos ADRs
10. Resumo consolidado

---

## Como Escrever Novos Testes

### Estrutura básica de um teste de integração com Jest + Supertest

```javascript
const request = require('supertest');
const { app } = require('../app');
const mongoose = require('mongoose');

describe('Order API', () => {
  let authToken;

  beforeAll(async () => {
    // Autenticação mock ou geração de token JWT de teste
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('POST /api/order - deve criar um novo pedido com sucesso', async () => {
    const res = await request(app)
      .post('/api/order')
      .set('Cookie', [`accessToken=${authToken}`])
      .send({
        items: [{ product: '60d5ec49f1b2c81184a7e123', quantity: 2 }]
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
  });
});
```

---

## Critérios de Aceitação para PRs

- `npm test` passa sem erros.
- `bash pos-backend/scripts/verify.sh` é executado sem nenhuma falha de severidade bloqueante.
- Novos endpoints REST possuem pelo menos 1 teste de sucesso (200/201) e 1 teste de erro/autorização (401/403).

## Skills Relacionadas

- `pos-controle-de-mudancas` — regras de alteração de código
- `pos-build-e-ambiente` — setup de pré-requisitos para testes

## Proveniência e Manutenção

- Verificado em: 2026-07-20
- Fontes primárias:
  - `pos-backend/package.json`
  - `pos-backend/tests/phase8-pdv-models.test.js`
  - `pos-backend/scripts/verify.sh`
- Comandos de reverificação:
  - `cd pos-backend && npm test`
  - `cd pos-backend && bash scripts/verify.sh`
