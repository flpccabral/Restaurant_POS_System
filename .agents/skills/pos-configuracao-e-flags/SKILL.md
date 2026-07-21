---
name: pos-configuracao-e-flags
description: >-
  Use quando precisar gerenciar variáveis de ambiente, configurações imutáveis do servidor,
  políticas operacionais de estoque, parâmetros CORS, Timezone ou adicionar novas opções
  de configuração no Restaurant POS System.
---

# Configuração e Flags — Restaurant POS System

## Quando usar

- Adicionar ou alterar variáveis em `pos-backend/config/config.js`
- Modificar políticas de segurança ou CORS
- Configurar fuso horário do servidor
- Entender como as variáveis do `.env` são carregadas e validadas no backend

## Quando não usar

- Setup do ambiente inicial de desenvolvimento (→ `pos-build-e-ambiente`)
- Alterações de código de negócio (→ `pos-controle-de-mudancas`)

---

## Mapeamento de Configurações (`config/config.js`)

O arquivo `pos-backend/config/config.js` é a fonte centralizada e imutável de configurações do servidor.

```javascript
// Propriedades expostas pelo config.js
const config = Object.freeze({
    port: process.env.PORT || 3000,
    databaseURI: process.env.MONGODB_URI || "mongodb://localhost:27017/pos-db",
    nodeEnv: process.env.NODE_ENV || "development",
    accessTokenSecret: process.env.JWT_SECRET || "test-secret-key-for-jwt",
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    razorpaySecretKey: process.env.RAZORPAY_KEY_SECRET,
    razorpyWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:5174,http://localhost:3000").split(",")
});
```

---

## Regras de Configuração

1. **Imutabilidade:** O objeto exportado é protegido com `Object.freeze()`. Nenhuma propriedade pode ser alterada em tempo de execução.
2. **Timezone Padrão:** A aplicação força o fuso horário para `America/Sao_Paulo` (UTC-3) na inicialização via `process.env.TZ`.
3. **CORS:** Origens permitidas são lidas da variável `CORS_ORIGINS` (separadas por vírgula). Esta mesma lista é aplicada tanto ao Express quanto ao Socket.io.
4. **Variáveis Obsoletas / Inconsistentes:** `SOCKET_CORS_ORIGIN` no `.env.example` é ignorada pelo código.

---

## Adicionando uma Nova Variável de Ambiente

1. Adicionar o valor padrão em `pos-backend/.env.example`.
2. Mapear a propriedade em `pos-backend/config/config.js` dentro do `Object.freeze({...})`.
3. Documentar a variável na tabela de variáveis do `CONTRIBUTING.md`.
4. Atualizar o `verify.sh` se a variável for crítica/obrigatória.

---

## Skills Relacionadas

- `pos-build-e-ambiente` — variáveis necessárias para subir o ambiente
- `pos-seguranca` — manipulação de segredos e chaves sensíveis

## Proveniência e Manutenção

- Verificado em: 2026-07-20
- Fontes primárias:
  - `pos-backend/config/config.js`
  - `pos-backend/.env.example`
