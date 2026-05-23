# Matriz de Permissoes do Piloto Controlado

## Perfis de Usuario

### 1. Master Admin / Owner (Admin Mestre)

**Descricao:** Acesso irrestrito a toda a rede. Enxerga todas as lojas, ingredientes,
estoques, politicas, alertas e auditoria.

**Pode ver:**
- Sumario de todas as lojas do food park
- Saude de estoque de qualquer loja + central
- Todos os alertas (qualquer loja)
- Todas as recomendacoes (rede inteira)
- Timeline completa da rede
- Todas as politicas (criar, editar, desativar)
- Logs de auditoria de todas as lojas
- Ingredientes globais
- Usuarios de todas as lojas

**Pode executar:**
- Resolver alertas de qualquer loja (inventory:adjust)
- Ignorar alertas de qualquer loja (inventory:adjust)
- Executar transferencia central -> loja (inventory:transfer)
- Executar transferencia loja -> loja (inventory:transfer)
- Registrar compra (inventory:adjust)
- Criar/Editar/Desativar politicas de estoque (inventory:adjust)
- Gerenciar usuarios de qualquer loja (users:manageRoles)
- Gerenciar roles (users:manageRoles)

**Nao pode:**
- (Nada — e acesso total)

**Credencial piloto:** piloto.admin@pos.com / admin123

---

### 2. Gerente (Operational Manager)

**Descricao:** Gerencia as operacoes da sua loja. Responsavel por estoque, alertas,
transferencias e politicas.

**Pode ver:**
- Saude de estoque da sua loja + central
- Alertas da sua loja
- Recomendacoes da sua loja + rede
- Timeline da sua loja
- Politicas da sua loja
- Produtos e receitas da sua loja
- Relatorios da sua loja
- Usuarios da sua loja (somente leitura)

**Pode executar:**
- Resolver alertas (inventory:adjust)
- Ignorar alertas (inventory:adjust)
- Executar transferencia central -> loja (inventory:transfer)
- Registrar compra (inventory:adjust)
- Criar/Editar/Desativar politicas (inventory:adjust)

**Nao pode:**
- Criar/deletar usuarios
- Gerenciar roles
- Acessar dados financeiros de outras lojas
- Transferir estoque de outra loja sem permissao

**Credencial piloto (Hamburgueria):** hamburgueria.gerente@pos.com / hamb123
**Credencial piloto (Pizzaria):** pizzaria.gerente@pos.com / pizz123
**Credencial piloto (Arabe):** arabe.gerente@pos.com / arabe123
**Credencial piloto (Bar):** bar.gerente@pos.com / bar123
**Credencial piloto (Central):** central.gerente@pos.com / central123

---

### 3. Operator (Operador de Loja)

**Descricao:** Operador do dia a dia. Foco em executar acoes no estoque conforme
orientacao do gerente.

**Pode ver:**
- Saude de estoque da sua loja
- Alertas da sua loja
- Recomendacoes da sua loja
- Timeline da sua loja
- Politicas da sua loja (somente leitura)

**Pode executar:**
- Resolver alertas (inventory:adjust) — aprovado pelo gerente
- Ignorar alertas (inventory:adjust) — aprovado pelo gerente
- Executar transferencia central -> loja (inventory:transfer)
- Registrar compra (inventory:adjust)

**Nao pode:**
- Criar/Editar/Desativar politicas
- Gerenciar usuarios
- Acessar dados financeiros
- Ver dados de outras lojas
- Acessar auditoria

**Credencial piloto (Hamburgueria):** hamburgueria.operador@pos.com / hamb123
**Credencial piloto (Pizzaria):** pizzaria.operador@pos.com / pizz123
**Credencial piloto (Arabe):** arabe.operador@pos.com / arabe123
**Credencial piloto (Bar):** bar.operador@pos.com / bar123
**Credencial piloto (Central):** central.operador@pos.com / central123

---

### 4. Viewer (Observador / Consultor)

**Descricao:** Acesso somente leitura. Enxerga dados de todas as lojas mas nao
pode executar nenhuma acao. Ideal para consultores, auditoria externa ou
proprietario que so quer acompanhar.

**Pode ver:**
- Tudo que o Master Admin ve: estoque, alertas, recomendacoes, timeline, politicas
- Logs de auditoria (GET /api/audit)

**Pode executar:**
- Nenhuma acao operacional
- Nenhum botao de execucao aparece na interface

**Nao pode:**
- Resolver/ignorar alertas
- Executar transferencias
- Registrar compras
- Criar/editar/desativar politicas
- Gerenciar usuarios
- Alterar qualquer dado

**Credencial piloto:** piloto.viewer@pos.com / viewer123

---

### 5. Caixa (Cashier)

**Descricao:** Operador de caixa/POS. Foco em vendas, nao em estoque.

**Pode ver:**
- Produtos e precos
- Pedidos em aberto
- Mesas ocupadas
- Saldo de cliente (pagamentos)

**Pode executar:**
- Criar pedidos (orders:create)
- Processar pagamentos (payments:create)
- Fechar conta

**Nao pode:**
- Ver estoque (inventory:read = false)
- Ver alertas
- Ver recomendacoes
- Ver timeline
- Ver politicas
- Executar transferencias

**Observacao:** Para o piloto, o Caixa nao acessa o Console Operacional.
Seu foco e o PDV.

---

### 6. Gargom (Waiter)

**Descricao:** Atendente de salao. Foco em atender mesas e registrar pedidos.

**Pode ver:**
- Produtos e precos
- Mesas
- Pedidos

**Pode executar:**
- Criar pedidos (orders:create)
- Atualizar pedidos (orders:update)

**Nao pode:**
- Ver estoque
- Ver console operacional
- Processar pagamentos
- Alterar precos ou produtos

---

## Resumo do Console Operacional por Perfil

| Funcionalidade               | Master Admin | Gerente | Operator | Viewer | Caixa | Gargom |
|------------------------------|:---:|:---:|:---:|:---:|:---:|:---:|
| Overview (metricas)          | SIM | SIM (loja) | SIM (loja) | SIM | NAO | NAO |
| Saude do Estoque             | SIM | SIM | SIM | SIM | NAO | NAO |
| Alertas - visualizar         | SIM | SIM | SIM | SIM | NAO | NAO |
| Alertas - Resolver           | SIM | SIM | SIM | NAO | NAO | NAO |
| Alertas - Ignorar            | SIM | SIM | SIM | NAO | NAO | NAO |
| Recomendacoes - visualizar   | SIM | SIM | SIM | SIM | NAO | NAO |
| Recomendacoes - executar     | SIM | SIM | SIM | NAO | NAO | NAO |
| Timeline                     | SIM | SIM | SIM | SIM | NAO | NAO |
| Politicas - visualizar       | SIM | SIM | SIM | SIM | NAO | NAO |
| Politicas - Criar/Editar     | SIM | SIM | NAO | NAO | NAO | NAO |
| Politicas - Desativar        | SIM | SIM | NAO | NAO | NAO | NAO |
| Auditoria (logs)             | SIM | NAO | NAO | SIM | NAO | NAO |
| Usuarios                     | SIM | NAO | NAO | NAO | NAO | NAO |

## Permissoes Tecnicas (Role Model)

Cada perfil mapeia para permissoes no model `Role`:

```
inventory:
  read: true    -> Ve dados do estoque
  adjust: true  -> Pode resolver/ignorar alertas, criar/editar politicas
  transfer: true -> Pode executar transferencias
```

## Controle via Frontend

- useCapabilities hook verifica permissoes antes de renderizar botoes
- Botoes de acao usam tooltips explicativos quando desabilitados
- Backend reforca as permissoes via middleware `checkPermission`
- Store isolation impede acesso a dados de outras lojas
