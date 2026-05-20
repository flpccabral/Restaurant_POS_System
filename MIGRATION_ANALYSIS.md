# Relatório de Análise de Arquitetura e Migração (Engenharia Reversa)

Este documento apresenta a análise do sistema de PDV (Ponto de Venda) existente (`flpccabral/Restaurant_POS_System`) com o objetivo de preparar a aplicação para uma arquitetura baseada em um terminal frontend leve (Thin Client) integrado a um backend centralizado e inteligente, preparado para integração com agentes de IA.

---

## 1. Mapeamento do Banco de Dados Atual

Atualmente, o backend (MERN stack) utiliza o MongoDB com o Mongoose. O modelo de dados possui as seguintes coleções (Tabelas) e relacionamentos:

### **Coleção: `users` (Usuários)**
- **Campos:** `name` (String), `email` (String), `phone` (Number), `password` (String, encriptada), `role` (String).
- **Responsabilidade:** Controle de acesso (Admin, Staff, etc.).

### **Coleção: `tables` (Mesas)**
- **Campos:** `tableNo` (Number), `status` (String - "Available", "Booked"), `seats` (Number), `currentOrder` (ObjectId, referência à coleção `Order`).
- **Responsabilidade:** Controle de disponibilidade física das mesas.

### **Coleção: `orders` (Pedidos/Vendas)**
- **Campos:**
  - `customerDetails`: `name`, `phone`, `guests`
  - `orderStatus`: Status do pedido (ex: "In Progress", "Ready")
  - `orderDate`: Data e hora
  - `bills`: `total`, `tax`, `totalWithTax` (Totalizadores financeiros)
  - `items`: Lista (Array) de itens comprados no formato enviado pelo frontend.
  - `table`: Referência (ObjectId) para a coleção `tables`
  - `paymentMethod`: Método de pagamento ("Cash" ou "Online")
  - `paymentData`: Dados de transação no Razorpay (`razorpay_order_id`, `razorpay_payment_id`)
- **Responsabilidade:** Registro consolidado de vendas, clientes atrelados e pagamentos vinculados.

### **Coleção: `payments` (Pagamentos)**
- **Campos:** `paymentId`, `orderId`, `amount`, `currency`, `status`, `method`, `email`, `contact`, `createdAt`.
- **Responsabilidade:** Histórico transacional independente de integrações.

### ⚠️ **Ausência Crítica (Produtos, Categorias e Estoque)**
Não existem coleções de banco de dados para o catálogo (Produtos, Categorias ou Estoque). Toda a estrutura de cardápio está **chumbada no código frontend** (hardcoded no arquivo `pos-frontend/src/constants/index.js`), o que impede o controle centralizado ou dinâmico de inventário no modelo atual.

---

## 2. Extração da Lógica de Negócio

- **Fluxo de Processamento de Venda:**
  A maior parte das regras de negócio hoje reside no frontend.
  1. O usuário adiciona itens no Redux (Cart).
  2. O frontend calcula o imposto (`tax = total * 5.25%`) e o total absoluto com taxas (`totalWithTax = total + tax`).
  3. No pagamento "Online", o front chama a API do Razorpay para criar e verificar o pedido.
  4. Após o pagamento ser finalizado com sucesso (ou se escolhido "Cash"), o frontend compõe todo o objeto da Venda e faz o envio (POST) para o endpoint `/api/order/`.
  5. Após criar o pedido, o frontend envia uma nova requisição (`PUT /api/table/:id`) para marcar a mesa como "Booked".

- **Cálculo de Totais:**
  Atualmente calculado integralmente pelo frontend (`pos-frontend/src/components/menu/Bill.jsx`).

- **Controle de Estoque:**
  **Inexistente.** Não há lógica implementada que debite estoque, alerte falta de insumos ou rastreie a venda frente aos ingredientes, já que os produtos não existem no banco de dados.

---

## 3. Identificação de Fluxos Críticos do PDV (Interface)

Para que a operação da loja (frontend leve) continue funcional, as seguintes funcionalidades de tela e fluxos devem ser rigorosamente replicados no novo app do PDV:

1. **Autenticação de Terminal e Usuários:** Login do operador de caixa e controle de permissões.
2. **Dashboard de Resumo:** Visualização em tempo real das metas, vendas do turno e pedidos em andamento (In Progress).
3. **Gestão de Layout/Mesas:** Possibilidade de visualizar todas as mesas (Livre vs. Ocupada) e associar um pedido a elas.
4. **Cardápio e Lançamento de Itens (Menu / Cart):**
   - Navegação fluida entre Categorias.
   - Adição/Remoção rápida de itens ao carrinho.
   - Associação dos dados do cliente (Nome, Telefone).
5. **Checkout e Faturamento (Billing):**
   - Resumo e cálculos (imposto/taxas) visíveis ao operador.
   - Integração com máquina de cartão (pagamento Online/Dinheiro).
6. **Tela de Pedidos (Orders):**
   - Painel (KDS ou Gestão do POS) onde ficam separados os estados de "All", "In Progress", "Ready", e "Completed".

---

## 4. Plano de Evolução para API REST (Backend Centralizado e Integrável com IA)

A nova arquitetura moverá toda a lógica do PDV para o backend. O frontend será apenas um "desenhador de interface" que consome e exibe dados (Thin Client), permitindo que agentes de IA possam atuar no sistema (ex: chatbots anotando pedidos, IA analisando compras e reposição de estoque, etc).

### A. Novos Modelos de Banco de Dados:
- **`Category`:** Nome, ícone, cor, descrição.
- **`Product`:** Nome, preço, descrição, ID da categoria.
- **`Inventory` (Estoque):** Quantidade atual por Produto (ou por Insumo), nível mínimo, custo unitário.

### B. Sugestão de Endpoints REST Centralizados:

1. **Catálogo e Estoque**
   - `GET /api/v2/menu` -> Retorna os dados agrupados de categorias e produtos ativos para o PDV (substitui o arquivo estático).
   - `GET /api/v2/inventory/:productId` -> Consulta rápida para ver se algo está esgotado (O PDV pode desabilitar botões na interface).

2. **Cálculo e Simulação de Venda (Checkout)**
   - `POST /api/v2/orders/simulate` -> O PDV envia um payload com os IDs dos produtos e quantidades: `[{productId: "123", qty: 2}]`. O backend retorna o Total, Impostos Calculados e disponibilidade. Isso blinda o sistema contra manipulação de preços no frontend.

3. **Criação Atômica de Pedidos (Order Placement)**
   - `POST /api/v2/orders` -> O PDV envia a solicitação de fechamento:
     - Cria o Pedido (`order`).
     - Altera a Mesa (`table.status = 'Booked'`).
     - Cria o histórico Financeiro (`payment`).
     - **Debita do Estoque (`inventory.qty -= 1`).**
     *Tudo em uma única Transação (Transaction/Session) do banco de dados, para evitar concorrência e falhas de rede do PDV.*

4. **Gerenciamento Operacional (Pronto para Agentes de IA)**
   - `PATCH /api/v2/orders/:id/status` -> IA ou operadores podem atualizar status de cozinha ("Em Preparo", "Pronto").
   - `GET /api/v2/reports/sales-today` -> Endpoint projetado para um Agente de IA consumir dados rapidamente e gerar relatórios executivos pelo WhatsApp/Telegram, por exemplo.

### Resumo do Benefício da Migração:
Tirando as regras de preço e catálogos constantes do React e movendo-as para a API, você estabelece uma verdadeira "Fonte Única de Verdade" (Single Source of Truth). O Frontend fica imune a bugs lógicos e as automações (IA) podem interagir diretamente com o Node.js/Mongo para ler estoques, prever compras futuras, injetar pedidos de delivery e criar relatórios sem precisar tocar na tela do PDV físico.