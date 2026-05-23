# Guia Rapido do Console Operacional -- Restaurant POS

## Acessando o Console
- URL: http://localhost:5173/console
- Login: use suas credenciais
- O link do Console (icone de monitor) aparece no Header apos login

## Interpretando o Console

### Visao Geral
Mostra resumo: total de ingredientes, rupturas, criticos, normais e alertas recentes.

### Saude do Estoque
Tabela com status de cada ingrediente:
- **Ruptura** (vermelho): saldo zerado -- acao urgente
- **Critico** (laranja): abaixo do minimo
- **Baixo** (amarelo): abaixo do ponto de reposicao
- **Normal** (verde): dentro da faixa ideal
- **Excesso** (azul): acima do maximo -- considere transferir
- **Sem Politica** (cinza): cadastre uma politica para monitorar

### Alertas
Alertas gerados automaticamente. Para resolver:
1. Avalie o alerta
2. Clique "Resolver" (verde) se a situacao foi corrigida
3. Clique "Ignorar" (cinza) se for falso positivo

### Recomendacoes
Sugestoes do sistema:
- **Central -> Loja**: transfira do estoque central
- **Entre Lojas**: transfira de outra operacao com excesso
- **Compra**: sem fonte interna -- registre a necessidade de compra

### Timeline
Historico cronologico de todos os eventos: movimentacoes, producoes, alertas.

### Politicas
Configure parametros de estoque: minimo, ponto de reposicao, ideal e maximo.

## Acoes disponiveis
- Resolver/Ignorar alertas (requer permissao inventory:adjust)
- Executar transferencias (requer permissao inventory:transfer)
- Criar/Editar/Desativar politicas (requer permissao inventory:adjust)

## Permissoes
- **Master Admin**: acesso total a todas as funcionalidades
- **Operadores com inventory:read**: visualizam dados mas nao executam acoes
- **Operadores com inventory:adjust**: podem gerenciar alertas e politicas
- **Operadores com inventory:transfer**: podem executar transferencias

## Limitacoes Conhecidas
- Sem compra automatica -- compras devem ser feitas fora do sistema
- Sem aprovacao multiusuario
- Sem mobile app
- Os dados de consumo (24h/7d) dependem de vendas registradas no sistema
