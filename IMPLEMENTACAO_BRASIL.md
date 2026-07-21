# RESTAURANT POS SYSTEM — IMPLEMENTAÇÃO BRASIL

## INSTRUÇÕES

Este documento contém prompts auto-contidos para implementar cada funcionalidade. Cada prompt é independente e pronto para ser delegado a um subagente (Tier 3) seguindo o fluxo GitHub Gate:

1. **Revisor (você):** avalia o prompt, ajusta premissas se necessário
2. **Executor (subagente):** recebe o prompt + contexto, implementa
3. **Validador (você):** verifica o resultado

---

## PROMPT A — MIGRAÇÃO RAZORPAY → MERCADO PAGO (CRÍTICO)

```
TASK: Migrar gateway de pagamento de Razorpay (Índia) para Mercado Pago (Brasil).

CONTEXTO:
- Frontend React 18 + Redux Toolkit + React Query + Axios
- Backend Node.js/Express + MongoDB (porta 8000)
- API endpoints atuais em src/https/index.js:
  - createOrderRazorpay → POST /api/payment/create-order
  - verifyPaymentRazorpay → POST /api/payment//verify-payment (dupla barra, bug existente)
- Modelo de Order tem campo paymentMethod com valores: Dinheiro, Pix, Debito, Credito, Voucher
- Bill.jsx (src/components/menu/Bill.jsx) — fluxo de checkout
- Invoice.jsx (src/components/invoice/Invoice.jsx) — exibe Razorpay order/payment IDs
- TableBill.jsx (src/pages/TableBill.jsx) — fechamento de mesa

REQUISITOS:
1. REMOVER completamente Razorpay:
   - Remover createOrderRazorpay + verifyPaymentRazorpay de src/https/index.js
   - Remover referências a razorpay_order_id / razorpay_payment_id de Invoice.jsx
   - Remover endpoint de payment do backend (rotas /api/payment/*)

2. ADICIONAR Mercado Pago:
   - npm install mercadopago
   - Criar variáveis de ambiente: MP_ACCESS_TOKEN, MP_PUBLIC_KEY, MP_WEBHOOK_SECRET, API_URL
   - Criar endpoint backend: POST /api/payment/mercadopago/create
   - Criar webhook backend: POST /api/webhooks/mercadopago (validação HMAC-SHA256)
   - Criar API frontend: createMpPayment, getMpPayment em src/https/index.js

3. PIX:
   - No checkout (Bill.jsx), se paymentMethod === 'Pix', chamar createMpPayment
   - Exibir QR Code PIX (copia-cola + imagem base64) para o cliente
   - Aguardar confirmação via polling ou WebSocket
   - Não fechar pedido até confirmação do PIX

4. CARTÃO PARCELADO:
   - Se paymentMethod === 'Credito', exibir seletor de parcelas (1x a 12x)
   - Enviar parcelas na criação do pagamento
   - Mercado Pago processa e retorna status

5. MODELO Order:
   - Adicionar campos: mpPaymentId (Number), pixQrCode (String), pixQrCodeBase64 (String), pixExpiresAt (String)
   - Índice em mpPaymentId

6. WEBHOOK:
   - POST /api/webhooks/mercadopago recebe notificação
   - Valida HMAC-SHA256 com constant-time comparison
   - Atualiza order.paymentStatus
   - Publica via WebSocket para frontend

7. MÉTODOS OFFLINE (Dinheiro, Débito, Voucher):
   - Continuar funcionando como hoje (sem gateway)
   - Apenas marcar paymentStatus = 'paid' no backend

REGRAS:
- Manter métodos offline funcionando independentemente do gateway
- Pix tem expiração (30 min) — mostrar timer no frontend
- Cartão parcelado: juros do lojista (Mercado Pago calcula automaticamente)
- NÃO usar polling — usar webhook + WebSocket
- Tratar erros: PIX expirado, cartão recusado, timeout
```

---

## PROMPT B — IMPRESSÃO TÉRMICA ESC/POS + COZINHA (KDS)

```
TASK: Implementar impressão térmica ESC/POS e tela de cozinha (KDS) para restaurante brasileiro.

CONTEXTO:
- Frontend React 18 (src/)
- Backend Node.js/Express (porta 8000)
- src/components/menu/Bill.jsx — botão "Imprimir" (onClick vazio)
- src/components/pdv/PdvFooterActions.jsx — botão "Imprimir" desabilitado ("Em breve")
- src/components/invoice/Invoice.jsx — window.print() atual (não funcional para térmica)
- OrderCard.jsx — exibe status dos pedidos
- Orders.jsx — lista de pedidos com filtros

REQUISITOS:

PARTE 1 — IMPRESSÃO TÉRMICA (BACKEND)
1. npm install node-escpos (ou thermal-printer)
2. Criar serviço: src/services/thermalPrinterService.js
3. Criar endpoint: POST /api/print/receipt
   - Body: { orderId, printerType: 'receipt' | 'kitchen' }
4. Suportar impressoras:
   - USB (via node-escpos)
   - Rede/IP (porta 9100 — protocolo ESC/POS padrão)
5. Templates de impressão:
   - Cupom não-fiscal (receipt): nome restaurante, itens, quantidades, preços, total, forma pagamento, data, observações
   - Comanda de cozinha (kitchen): mesa/balcao, itens, quantidades, observações, número do pedido
6. Configuração via banco: modelo Printer com campos { storeId, type, protocol, ipAddress, port, paperWidth }

PARTE 2 — TELA DE COZINHA (KDS) — FRONTEND
7. Criar página: /kitchen (src/pages/Kitchen.jsx)
   - Rota protegida, sem header padrão (fullscreen)
8. Componente KitchenDisplay:
   - Grid responsivo de cards de pedido
   - Cada card: número pedido, mesa, itens (com observações destaque), timer desde a criação
   - Botão "Pronto" (muda status para Ready)
   - Botão "Entregar" (muda status para completed) — exibe só após Ready
   - Cores: vermelho (>15min), amarelo (>10min), verde (<10min)
9. WebSocket em tempo real:
   - Conectar via Socket.IO ou SSE
   - Novo pedido aparece automaticamente
   - Pedido pronto some da tela após "Entregar"
10. Reproduzir som (beep) ao receber novo pedido na cozinha

PARTE 3 — INTEGRAÇÃO
11. Bill.jsx: ao criar pedido, chamar POST /api/print/receipt automaticamente (tipo kitchen)
12. Botão "Imprimir" no Bill.jsx chama POST /api/print/receipt (tipo receipt)
13. PdvFooterActions.jsx: habilitar botão "Imprimir" se houver impressoras configuradas

REGRAS:
- Impressora configurável por loja (cada loja pode ter sua própria)
- Falha de impressão NÃO impede o pedido (assíncrono)
- Log de erros de impressão no console operacional
- Tela de cozinha deve ocupar 100% da altura da tela (modo quiosque)
```

---

## PROMPT C — EMISSÃO FISCAL NFC-e (BRASIL)

```
TASK: Implementar emissão de NFC-e (Nota Fiscal ao Consumidor eletrônica) para restaurantes brasileiros.

CONTEXTO:
- Restaurante POS System, MERN stack
- Após pagamento/checkout, o sistema precisa emitir documento fiscal
- Microempresa / MEI: regime simplificado (SEM contador próprio)
- Porta 8000 (backend)

REQUISITOS:

PARTE 1 — MODELO FISCAL
1. Adicionar ao modelo Order (MongoDB):
   - nfceStatus: 'pending' | 'issued' | 'failed' | 'cancelled'
   - nfceKey: String (chave de 44 dígitos)
   - nfceNumber: Number
   - nfceSeries: Number
   - nfceXmlUrl: String
   - nfceDanfeUrl: String
   - cpfCnpjConsumer: String (CPF/CNPJ do consumidor, opcional)
   - cfeSat: String (para SAT SP)

PARTE 2 — INTEGRAÇÃO (ESCOLHER UMA ROTA)

OPÇÃO A — API TERCEIRA (recomendado para MVP):
- Integrar com API de emissão NF (ex: Focus NFe, TecnoSpeed, Webmania)
- Fluxo:
  1. Ao finalizar venda, montar XML da NFC-e
  2. Enviar para API terceira
  3. API transmite para SEFAZ + retorna DANFe (PDF)
  4. Salvar chave de acesso e URL no pedido
  5. Disponibilizar PDF para download/impressão

OPÇÃO B — SAT (São Paulo):
- Integrar com SAT fiscal (CFe-SAT)
- Biblioteca: node-sat ou comunicação via DLL/webservice
- Fluxo:
  1. Gerar CFe
  2. Assinar digitalmente
  3. Transmitir via SAT
  4. Imprimir cupom via SAT

PARTE 3 — CAPTURA CPF/CNPJ
3. Bill.jsx: adicionar ao modal de dados do cliente:
   - Campo opcional: "CPF/CNPJ na nota?"
   - Validar CPF (11 dígitos) ou CNPJ (14 dígitos)
   - Se informado, incluir no XML da NFC-e
4. Exibir chave NFC-e no comprovante e permitir consulta

PARTE 4 — DANFE (PDF)
5. Gerar PDF do DANFE (Documento Auxiliar da NFC-e)
   - Usar biblioteca: pdfkit ou puppeteer
   - Template com layout padrão SEFAZ (simplificado)
6. Endpoint: GET /api/nfce/:orderId/pdf
   - Retorna PDF para download/impressão

PARTE 5 — CANCELAMENTO
7. Endpoint: POST /api/nfce/:orderId/cancel
   - Válido apenas até 30 min após emissão
   - Exige justificativa (mín. 15 caracteres)
   - Comunica com API/SEFAZ para cancelar
8. OrderStatus 'cancelled' → tentar cancelar NFC-e automaticamente

REGRAS:
- CPF/CNPJ na nota é OPCIONAL (não pode travar o fechamento se usuário pular)
- Em caso de falha SEFAZ (instabilidade), marcar nfceStatus='failed' e permitir reenvio
- Salvar XML completo no banco (para consulta futura)
- Log de todas as tentativas (para contador)
```

---

## PROMPT D — DIVISÃO DE CONTA (SPLIT BILL)

```
TASK: Implementar divisão de conta entre pessoas (split bill), essencial em restaurante brasileiro.

CONTEXTO:
- Sistema com pedidos por mesa (dine_in) e balcão (counter)
- src/pages/TableBill.jsx — fechamento de mesa
- src/components/menu/Bill.jsx — checkout
- Redux store: customerSlice (guests), cartSlice

REQUISITOS:

PARTE 1 — DIVISÃO IGUAL (EQUAL SPLIT)
1. Na tela TableBill.jsx, adicionar botão "Dividir Conta"
2. Modal de split com opções:
   - "Dividir igualmente entre N pessoas" (usa guests do pedido)
   - "Dividir por itens" (cada um paga o que consumiu)
3. Divisão igual:
   - Total da mesa / N pessoas
   - Exibir valor por pessoa
   - Cada pessoa pode pagar com forma diferente (ex: João PIX, MariaDinheiro)

PARTE 2 — DIVISÃO POR ITENS (ITEM SPLIT)
4. Selecionar itens do pedido e associar a cada pessoa
5. Interface:
   - Lista de convidados (nome + valor parcial)
   - Cada item do pedido tem checkbox + seletor de pessoa
   - Totalizador: soma dos parciais = total da mesa
6. Validação: todos os itens devem ser alocados a alguém

PARTE 3 — PAGAMENTO MISTO
7. Ao fechar mesa, permitir múltiplos pagamentos:
   - Ex: R$50 em dinheiro + R$73 no PIX
   - Cada pagamento com forma e valor
   - Soma dos pagamentos = total da mesa
8. Arredondamento:
   - Se divisão der R$40,666 → R$40,67 cada
   - Arredondar diferença para o último pagador

PARTE 4 — API
9. Endpoints backend:
   - POST /api/table/:tableId/split-calculate — calcula divisões
   - POST /api/table/:tableId/close-split — fecha com pagamentos múltiplos
10. Modelo PaymentSplit:
    - { tableId, payments: [{ personName, value, paymentMethod, items: [itemIds] }] }

REGRAS:
- Divisão igual: arredondar para centavos, diferença no último
- Pagamento misto: suportar até 5 formas diferentes por fechamento
- Cada pagamento é registrado separadamente no histórico
- Para balcão (counter): split não se aplica (pagamento único ou simplificado)
```

---

## PROMPT E — CAIXA DIÁRIO (ABERTURA/FECHAMENTO/SANGRIA)

```
TASK: Implementar fluxo completo de caixa diário para restaurante brasileiro.

CONTEXTO:
- Sistema multi-loja, multi-operador
- Cada operador precisa abrir e fechar caixa
- src/components/pdv/PdvFooterActions.jsx — botão "Fechar" (desabilitado, "Em breve")
- Pagamentos: Dinheiro, Pix, Débito, Crédito, Voucher
- Backend Node.js/Express + MongoDB

REQUISITOS:

PARTE 1 — MODELO CashRegister
1. Schema MongoDB:
   - _id, storeId, operatorId (ref User), openedAt, closedAt, initialBalance (Number)
   - status: 'open' | 'closed'
   - transactions: [{ type: 'sale'|'sangria'|'supply', paymentMethod, value, orderId, description, createdAt }]
   - closingSummary: { expectedCash, actualCash, difference, notes }
   - totals: { cash, pix, debit, credit, voucher } — somas por método

PARTE 2 — ABERTURA DE CAIXA
2. Ao fazer login como Caixa/Admin, se não houver caixa aberto:
   - Modal: "Abrir Caixa"
   - Campo: valor inicial em dinheiro
   - Botão: "Abrir Caixa"
3. Endpoint: POST /api/cash-register/open

PARTE 3 — VENDAS NO CAIXA
4. Cada venda (counter) registra transação no caixa aberto
5. Cada fechamento de mesa (dine_in) registra transação
6. Endpoint chamado automaticamente: POST /api/cash-register/:id/register-sale

PARTE 4 — SANGRIA E SUPRIMENTO
7. Botões no PDV:
   - "Sangria" → modal: valor + motivo (ex: "Pagamento fornecedor")
   - "Suprimento" → modal: valor + motivo (ex: "Troco")
8. Endpoints:
   - POST /api/cash-register/:id/sangria
   - POST /api/cash-register/:id/supply

PARTE 5 — FECHAMENTO DE CAIXA
9. Botão "Fechar" em PdvFooterActions.jsx:
   - Antes de fechar, conferência:
   - "Valor esperado em dinheiro: R$ X,XX"
   - "Valor real em dinheiro: R$ ___" (operador digita)
   - Diferença calculada automaticamente
   - Campo de observações
10. Endpoint: POST /api/cash-register/:id/close

PARTE 6 — RELATÓRIO DE FECHAMENTO
11. Exibir resumo do fechamento:
   - Totais por forma de pagamento
   - Número de vendas
   - Sangrias + suprimentos
   - Diferença de caixa
12. Opção de impressão (cupom não-fiscal de fechamento)

REGRAS:
- Apenas UM caixa aberto por loja por vez
- Se operador tentar fazer venda sem caixa aberto, bloquear com mensagem
- Sangria não pode superar saldo em dinheiro disponível
- Diferença de fechamento > R$50 → alerta no console operacional
- Caixa fecha automaticamente à meia-noite (cron job)
```

---

## PROMPT F — VÍNCULO GARÇOM/MESA + COMISSÃO

```
TASK: Implementar vínculo entre garçom e mesa, com cálculo de comissão.

CONTEXTO:
- Cadastro de funcionários com cargo (Garçom, Caixa, Administrador)
- User possui role, rolePermissions, store
- Tabela de mesas com status e dados do cliente
- src/pages/Tables.jsx, src/components/tables/TableCard.jsx

REQUISITOS:

PARTE 1 — VÍNCULO GARÇOM-MESA
1. Ao abrir mesa (TableCard.jsx), registrar garçom logado como "attendant"
2. Modelo Order: adicionar campo attendant (ref User)
3. Se garçom trocar de mesa, vínculo permanece no pedido original
4. Exibir nome do garçom no card da mesa (abaixo do cliente)

PARTE 2 — ATRIBUIÇÃO DE GARÇOM
5. TableCard.jsx: ao clicar em mesa ocupada, exibir:
   - Garçom responsável (se já houver)
   - Opção "Transferir" para outro garçom (apenas Admin/Caixa)
6. Novo pedido em mesa existente: manter garçom original

PARTE 3 — COMISSÃO
7. Modelo: User.roleConfig.commissionRate (percentual) — default 0
8. Cálculo:
   - Comissão = totalVendas * (commissionRate / 100)
   - Por período (diário, semanal, mensal)
9. Endpoint: GET /api/attendant/:id/commission
   - ?period=today|week|month|range&start=&end=
   - Retorna: { totalSales, totalOrders, commissionRate, commissionValue }

PARTE 4 — RELATÓRIO
10. Dashboard: nova aba "Comissões"
11. Tabela por garçom: nome, vendas, pedidos, taxa, valor comissão
12. Exportar (CSV) para folha de pagamento

REGRAS:
- Apenas cargo "Garçom" tem comissão configurável
- Admin/Caixa podem ver relatório de todos os garçons
- Garçom vê apenas suas próprias comissões
- Transferência de garçom registra log (quem transferiu, quando)
```

---

## PROMPT G — 10% SERVIÇO (GORJETA OPCIONAL)

```
TASK: Implementar taxa de serviço opcional de 10% (gorjeta), padrão cultural brasileiro.

CONTEXTO:
- Bill.jsx (src/components/menu/Bill.jsx) — resumo com subtotal, taxa (5.25%) e total
- PdvTotalBox.jsx — componente de totais
- Taxa atual fixa em 5.25% (taxRate em Bill.jsx linha 28)

REQUISITOS:

PARTE 1 — CONFIGURAÇÃO
1. Adicionar ao modelo Store (ou User.roleConfig):
   - serviceChargeEnabled: Boolean (default: true)
   - serviceChargeRate: Number (default: 10)
   - serviceChargeMode: 'optional' | 'mandatory' | 'disabled'

PARTE 2 — FLUXO NO PDV
2. Subistituir taxa fixa 5.25% por:
   - "Taxa de Serviço (10%)" — opcional, toggle liga/desliga
   - Se desligado, taxa = 0
   - Se ligado, taxa = valorItens * (serviceChargeRate / 100)
3. UI:
   - Antes de finalizar, toggle visual: "Adicionar 10% de serviço?"
   - Exibir valor: "R$ X,XX"
   - Tooltip: "A gorjeta é opcional e vai para os garçons"

PARTE 3 — DESTINAÇÃO
4. Modelo Order: campo serviceCharge (Number) e serviceChargeOpted (Boolean)
5. Relatório: total de gorjetas no período (para distribuição)
6. Endpoint: GET /api/dashboard/service-charge-summary

PARTE 4 — DINHEIRO vs CARTÃO
7. Se pagamento em dinheiro: gorjeta pode ser em dinheiro separado (não passa na maquininha)
8. Se cartão/PIX: gorjeta processada junto com o pagamento

REGRAS:
- NÃO pode ser pré-selecionada como "sim" (prática abusiva, proibida por lei)
- Usuário deve ativamente optar por pagar a taxa
- Texto de tooltip explica que é opcional
- Valor separado no resumo e na comanda
```

---

## PROMPT H — CADASTRO COMPLETO DE CLIENTES + HISTÓRICO

```
TASK: Implementar cadastro persistente de clientes com histórico de pedidos e preferências.

CONTEXTO:
- customerSlice.js — dados do cliente são voláteis (só na sessão)
- Bill.jsx — modal de dados do cliente antes de finalizar
- Cliente é digitado toda vez, sem persistência
- Order tem customerDetails embutido

REQUISITOS:

PARTE 1 — MODELO Customer (MongoDB)
1. Schema:
   - name, phone (unique), email, cpf (unique), birthDate
   - address: { street, number, complement, neighborhood, city, state, zipCode }
   - tags: [String] — ex: ['VIP', 'Aniversariante']
   - totalVisits: Number
   - totalSpent: Number
   - lastVisit: Date
   - createdAt, updatedAt

PARTE 2 — FLUXO DE ATENDIMENTO
2. Bill.jsx — modal de dados do cliente:
   - Campo "Telefone" → ao digitar, buscar cliente existente (debounce 500ms)
   - Se encontrado: auto-preenche nome e exibe "Cliente já cadastrado!"
   - Se não encontrado: habilita cadastro rápido
   - Validar CPF se informado
3. Endpoints:
   - GET /api/customer/search?phone=... — busca por telefone
   - POST /api/customer — cadastro
   - PUT /api/customer/:id — atualização
   - GET /api/customer/:id/history — pedidos anteriores

PARTE 3 — TELA DE CLIENTES
4. Nova página: /customers (src/pages/Customers.jsx)
   - Tabela: nome, telefone, visitas, gasto total, última visita
   - Busca por nome ou telefone
   - Filtro: "Mais frequentes", "Aniversariantes do mês"
   - Ações: Editar, Histórico

PARTE 4 — HISTÓRICO DO CLIENTE
5. Modal/aba: "Histórico do Cliente"
   - Lista de pedidos anteriores (data, itens, valor)
   - Preferências detectadas (ex: "Sempre pede ponto mal passado")
   - Total gasto e ticket médio
   - Última visita

PARTE 5 — ANIVERSÁRIO
6. Se birthDate cadastrado, exibir alerta no dashboard:
   - "Cliente X faz aniversário hoje!"
   - Sugestão: oferecer desconto cortesia

REGRAS:
- Cadastro NÃO obrigatório para fechar venda (cliente pode ser "avulso")
- Telefone é a chave de busca primária (mais prático que CPF)
- Dados do cliente persistem entre sessões
- Garçom pode cadastrar cliente durante o atendimento
```

---

## PROMPT I — CARDÁPIO DIGITAL (QR CODE NA MESA)

```
TASK: Implementar cardápio digital acessível via QR Code na mesa.

CONTEXTO:
- Sistema tem catálogo de produtos com categorias, variações e preços
- src/pages/Menu.jsx — PDV (interno)
- Precisamos de uma versão pública (sem login) para o cliente

REQUISITOS:

PARTE 1 — CARDÁPIO PÚBLICO
1. Nova página: /cardapio/:storeSlug (src/pages/CardapioDigital.jsx)
   - SEM autenticação (rota pública)
   - Exibir: logo do restaurante, nome
   - Grid de categorias → produtos → detalhes
2. Layout mobile-first:
   - Categorias como tabs horizontais roláveis
   - Produtos em lista com nome, descrição curta, preço, foto
   - Foto do produto (se houver) — caso contrário, placeholder
3. Endpoint backend:
   - GET /api/public/:storeSlug/menu — retorna categorias + produtos ativos
   - Sem expor preços internos ou variações complexas

PARTE 2 — QR CODE
4. Gerar QR Code por mesa:
   - GET /api/public/:storeSlug/qr/:tableNo
   - Retorna: { url: 'https://.../cardapio/storeSlug?mesa=5', svg: '...' }
5. Tela de configuração de mesas:
   - Botão "Imprimir QR Code" por mesa
   - Endpoint: GET /api/table/:id/qr-code (retorna PNG para download/impressão)
6. Biblioteca: qrcode (npm)

PARTE 3 — PEDIDO DO CLIENTE
7. Na página pública, cliente:
   - Seleciona itens e quantidade
   - Clica em "Enviar Pedido"
8. WebSocket/SSE: garçom recebe notificação "Mesa 5 fez um pedido!"
9. Pedido entra como "pending" — garçom confirma ou ajusta no PDV

PARTE 4 — INTEGRAÇÃO
10. Novos endpoints:
    - POST /api/public/order — cria pedido (status='pending', sem garçom)
    - GET /api/public/orders/:tableNo — consulta status dos pedidos da mesa
11. PDV (Menu.jsx): filtrar pedidos pending e permitir "Assumir"

REGRAS:
- Cardápio público NÃO permite pagamento (apenas pedido)
- Cliente não vê valores internos (custo, margem)
- Garçom precisa confirmar pedido antes de ir para cozinha
- QR Code impresso plastificado na mesa
```

---

## PROMPT J — MODO OFFLINE + PWA

```
TASK: Adicionar modo offline e Progressive Web App (PWA) para funcionar sem internet.

CONTEXTO:
- Frontend React 18 + Vite
- Ambiente de restaurante brasileiro com internet instável
- Dados críticos: cardápio, mesas, pedidos em andamento

REQUISITOS:

PARTE 1 — SERVICE WORKER + PWA
1. npm install vite-plugin-pwa
2. Configurar vite.config.js para PWA:
   - Nome: "Restro POS"
   - Short name: "Restro"
   - Theme color: #1d4ed8 (blue-700)
   - Display: standalone
   - Icon: logo.png
3. Service worker com cache-first para assets estáticos
4. Manifest.json gerado automaticamente

PARTE 2 — INDEXEDDB (CACHE OFFLINE)
5. npm install idb
6. Criar: src/services/offlineDb.js
   - Tabelas: products, categories, tables, orders, pendingOrders
   - Operações: getAll, getById, put, delete
7. Cache de dados mestres ao carregar:
   - Produtos e categorias: cache-first (servir do IndexedDB, atualizar em background)
   - Mesas: network-first com fallback para cache

PARTE 3 — PEDIDOS OFFLINE
8. Se sem internet ao criar pedido:
   - Salvar em pendingOrders no IndexedDB
   - Exibir notificação: "Pedido salvo offline. Será enviado quando houver conexão."
9. Ao reconectar (navigator.onLine + evento online):
   - Processar fila de pedidos pendentes
   - Notificar sucesso ou falha
10. Indicador visual: bolinha verde (online) / vermelha (offline) no header

PARTE 4 — SYNC BACKGROUND
11. Usar Background Sync API (se suportado)
12. Caso contrário, setInterval de 30s verifica fila

REGRAS:
- PDV nunca pode ficar inoperante por falta de internet
- Se ficar offline, o que já está em tela continua funcionando
- Impressão offline: enfileirar e imprimir quando online
- Sincronização bidirecional (evitar conflitos de dados)
```

---

## PROMPT K — DELIVERY + INTEGRAÇÃO iFOOD

```
TASK: Implementar módulo de delivery com integração iFood.

CONTEXTO:
- PdvFooterActions.jsx — botão "Delivery" desabilitado ("Em breve")
- customerSlice.js — orderType 'delivery' já existe
- Order tem customerDetails com name, phone, guests

REQUISITOS:

PARTE 1 — DELIVERY PRÓPRIO
1. Modal ao clicar "Delivery" em PdvFooterActions.jsx:
   - Dados do cliente (nome, telefone)
   - Endereço de entrega (CEP, rua, número, complemento, bairro)
   - Taxa de entrega (valor fixo ou calculado por distância)
   - Tempo estimado (configurável por loja)
2. Modelo Order: campos address (Object), deliveryFee (Number), estimatedTime (Number)
3. Fluxo:
   - Pedido → "Em Preparo" → "Saiu para Entrega" → "Entregue"
   - novo status: 'out_for_delivery', 'delivered'

PARTE 2 — INTEGRAÇÃO iFOOD
4. iFood Partner API:
   - Criar webhook para receber pedidos do iFood
   - Endpoint: POST /api/integrations/ifood/webhook
   - Mapear categorias iFood → categorias do sistema
5. Pedidos iFood aparecem automaticamente na tela de pedidos
6. Status sincronizado:
   - Sistema confirma → iFood: "Em Preparo"
   - Sistema marca "Saiu para Entrega" → iFood: "Saiu para Entrega"
   - Sistema marca "Entregue" → iFood: "Entregue"
7. Configuração: merchantId, merchantToken por loja

PARTE 3 — RASTREAMENTO
8. Cliente consegue ver status do pedido:
   - Página pública: /rastreio/:orderId
   - Status: Recebido → Em Preparo → Saiu pra Entrega → Entregue
   - Pagina simples, mobile-first

REGRAS:
- Taxa de entrega: configurável por loja, pode ser grátis acima de valor mínimo
- iFood: webhook deve validar assinatura HMAC
- Entregador: registrar quem entregou (entregador próprio ou iFood)
- Logística: área de cobertura por CEP (configurável)
```

---

## PROMPT L — RELATÓRIOS GERENCIAIS

```
TASK: Criar módulo completo de relatórios gerenciais para tomada de decisão.

CONTEXTO:
- Dashboard.jsx — atualmente só tem métricas básicas e pedidos recentes
- Aba "Pagamentos" vazia ("Em Breve")
- Dados disponíveis: pedidos, produtos, mesas, estoque

REQUISITOS:

PARTE 1 — NOVA ABA: RELATÓRIOS
1. Dashboard.jsx: quarta aba "Relatorios" ao lado de Metricas/Pedidos/Pagamentos
2. Seletor de período: Hoje, Ontem, Esta Semana, Este Mês, Últimos 30 Dias, Personalizado

PARTE 2 — RELATÓRIOS DISPONÍVEIS
3. Vendas por período:
   - Gráfico de vendas (diário)
   - Total, ticket médio, número de pedidos
   - Comparativo com período anterior (%)
4. Vendas por forma de pagamento:
   - Pizza: Dinheiro 40%, Pix 35%, Crédito 20%, Débito 5%
   - Gráfico de pizza (chart.js ou recharts)
5. Produtos mais vendidos:
   - Top 10 produtos por quantidade
   - Top 10 por receita
   - Margem de contribuição (se tiver custo cadastrado)
6. Vendas por garçom:
   - Total vendido por garçom no período
   - Comissão calculada
7. Vendas por horário:
   - Distribuição de vendas por hora do dia (pico de almoço vs jantar)
8. Estoque:
   - Giro de estoque (itens mais consumidos)
   - Perdas (se houver controle de vencimento)

PARTE 3 — API
9. Endpoints backend:
   - GET /api/reports/sales?period=...&storeId=...
   - GET /api/reports/payment-methods?period=...
   - GET /api/reports/top-products?period=...&limit=10
   - GET /api/reports/by-attendant?period=...
   - GET /api/reports/by-hour?period=...
   - GET /api/reports/stock-turnover?period=...

PARTE 4 — EXPORTAÇÃO
10. Botão "Exportar CSV" em cada relatório
11. Botão "Imprimir" (versão amigável para papel)

REGRAS:
- Dados agregados (não expor dados brutos individuais)
- Gráficos responsivos (mobile OK)
- Cache de relatórios pesados (30s TTL)
- Aba "Pagamentos" vazia pode ser substituída por "Relatorios"
```

---

## PROMPT M — RESERVAS DE MESA

```
TASK: Implementar sistema de reservas de mesa (não apenas alocação no momento).

CONTEXTO:
- README.md menciona "Table Reservations"
- Tables.jsx — apenas visualização de mesas atuais
- TableCard.jsx — abertura de mesa (imediata)
- Modelo Table existente (tableNo, seats, status)

REQUISITOS:

PARTE 1 — MODELO Reservation
1. Schema MongoDB:
   - storeId, tableId (opcional — pode ser "qualquer mesa"), customerName, customerPhone
   - guests (Number), date (Date), time (String — "19:30")
   - status: 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'no_show'
   - notes (String), createdAt, updatedAt

PARTE 2 — CALENDÁRIO DE RESERVAS
2. Nova página/aba: /reservations (src/pages/Reservations.jsx)
   - Layout semanal/diário
   - Cada reserva como card: horário, nome, convidados, mesa
   - Cores por status
3. Modal "Nova Reserva":
   - Cliente (nome, telefone)
   - Data, horário, número de convidados
   - Mesa específica (opcional — "Automático" se não escolher)
   - Observações
4. Sugestão automática de mesa:
   - Ao inserir convidados, sugerir mesas com capacidade suficiente
   - Bloquear mesas já reservadas no horário

PARTE 3 — FLUXO
5. Na data da reserva:
   - Abrir mesa (TableCard) → verifica se há reserva → exibe "Reserva de [nome]"
   - Garçom confirma chegada → reservation.status = 'seated'
   - Se não comparecer → botão "Não Compareceu" → 'no_show'
6. Notificações:
   - Lembretes de reserva (opcional: WhatsApp via API)
   - Alerta de no-show

PARTE 4 — RELATÓRIO
7. Relatório de reservas:
   - Confirmadas vs no-show (%)
   - Horário de pico de reservas
   - Clientes que mais reservam

REGRAS:
- Reserva NÃO impede venda normal (mesa sem reserva pode ser ocupada)
- Se mesa reservada chegar e estiver ocupada, realocar
- Limite de tempo por reserva (configurável: 2h para almoço, 3h para jantar)
- Cliente pode cancelar (via telefone — garçom registra)
```

---

## INSTRUÇÕES DE USO

1. Cada prompt é auto-contido — o subagente tem todo o contexto necessário
2. Após implementação, verificar:
   - Compilação sem erros (`npm run build`)
   - Testar fluxo principal (criar pedido, pagar, imprimir)
   - Validar regras de negócio listadas em cada prompt
3. Ordem sugerida de implementação:
   - **Fase 1 (crítico):** A (Mercado Pago) → B (Impressão) → C (NFC-e)
   - **Fase 2 (essencial):** D (Split) → E (Caixa) → F (Garçom) → G (10%)
   - **Fase 3 (desejável):** H (Clientes) → J (Offline/PWA) → K (Delivery)
   - **Fase 4 (diferencial):** I (QR Code) → L (Relatórios) → M (Reservas)
