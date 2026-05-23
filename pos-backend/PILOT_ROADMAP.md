# Roteiro Operacional do Piloto Controlado

## 1. Objetivo

Validar o sistema de estoque central inteligente em operacao real controlada,
com dados reais, usuarios reais e supervisao diaria.

## 2. Quem Vai Usar

| Papel | Pessoa | Acesso |
|-------|--------|--------|
| Proprietario / Master Admin | Dono do food park | Todas as lojas |
| Gerente Hamburgueria | Responsavel pela Hamburgueria | Sua loja + acoes |
| Operador Hamburgueria | Equipe da Hamburgueria | Sua loja + acoes limitadas |
| Gerente Pizzaria | Responsavel pela Pizzaria | Sua loja + acoes |
| Operador Pizzaria | Equipe da Pizzaria | Sua loja + acoes limitadas |
| Gerente Arabe | Responsavel pelo Arabe | Sua loja + acoes |
| Operador Arabe | Equipe do Arabe | Sua loja + acoes limitadas |
| Gerente Bar | Responsavel pelo Bar | Sua loja + acoes |
| Operador Bar | Equipe do Bar | Sua loja + acoes limitadas |
| Gerente Central | Responsavel pelo almoxarifado | Central + visao geral |
| Viewer | Consultor / observador | Tudo somente leitura |

## 3. Lojas no Piloto

| Loja | Nome no Sistema | Operacao |
|------|----------------|----------|
| 1 | PILOT_Hamburgueria | Hamburgueria artesanal |
| 2 | PILOT_Pizzaria | Pizzaria forno a lenha |
| 3 | PILOT_Arabe | Comida arabe e esfihas |
| 4 | PILOT_Bar | Bar e petiscos |
| 5 | PILOT_Central | Almoxarifado central do grupo |

## 4. Itens no Piloto (Escopo)

**Fase 1 (3-7 dias): Apenas itens essenciais de alto giro:**

- Proteinas: Carne bovina (moida), frango, calabresa, cordeiro
- Carboidratos: Pao de hamburguer, pao sirio, massa de pizza, batata pre-frita
- Laticinios: Queijo mussarela, parmesao, creme de leite
- Vegetais: Alface, tomate, cebola
- Temperos: Oleo de soja, azeite, sal, extrato de tomate
- Bebidas: Refrigerante lata, cerveja lata, agua mineral
- Embalagens: Hamburger paper, caixa de pizza, saco de papel

**Excluidos desta fase:**
- Itens de baixissimo giro (ex: fermento em po, corante)
- Itens de uso administrativo (ex: papel A4, canetas)
- Itens sazonais (ex: ingredientes de promocao temporaria)

## 5. Duracao do Piloto

**Minimo:** 3 dias consecutivos
**Ideal:** 7 dias (uma semana completa)
**Recomendado:** 5 dias (segunda a sexta)

## 6. Acoes Permitidas e Proibidas

### Permitidas (com supervisao)
- Visualizar saude do estoque
- Visualizar e gerenciar alertas (resolver/ignorar com justificativa)
- Executar transferencias central -> loja
- Executar transferencias loja -> loja (com aprovacao do gerente da origem)
- Registrar compras recebidas
- Criar e editar politicas de estoque (sob revisao do Master Admin)
- Consultar logs de auditoria (Master Admin / Viewer)

### Permitidas (somente Master Admin)
- Gerenciar usuarios
- Gerenciar roles e permissoes
- Acessar auditoria completa

### Proibidas
- Excluir politicas de estoque (apenas desativar)
- Alterar saldos de estoque manualmente (fora do sistema)
- Criar produtos ou receitas (fora do escopo do piloto)
- Alterar configuracoes de loja
- Remover logs de auditoria

## 7. Fluxo Diario Recomendado

### Manha (abertura)
1. Login no sistema
2. Abrir Console Operacional
3. Verificar Overview: metricas do dia anterior
4. Verificar Saude do Estoque: ingredientes em estado critico/ruptura
5. Verificar Alertas novos
6. Verificar Recomendacoes do dia

### Durante a operacao
1. Registrar compras recebidas (quando aplicavel)
2. Executar transferencias conforme necessidade
3. Resolver alertas quando a acao corretiva for feita
4. Manter politicas de estoque atualizadas

### Fim do dia (fechamento)
1. Revisar todos os alertas do dia
2. Verificar divergencias percebidas entre estoque real vs sistema
3. Registrar problemas encontrados
4. Revisar metricas do dia

## 8. Como Registrar Problemas

Cada usuario deve manter um registro simples de problemas:

**Metodo recomendado:** Planilha compartilhada ou documento com:

```
Data: __/__/____
Horario: __:__
Usuario: _______________
Loja: _________________
Problema: ________________________________________
Impacto: Alto / Medio / Baixo
Ja existe solucao?: Sim / Nao
Observacoes: ____________________________________
```

Alternativamente, usar o canal apropriado de comunicacao (grupo, chat, etc.).

## 9. Como Encerrar a Operacao do Dia

1. Execute o script de verificacao: `node scripts/test-phase6.js`
2. Extraia metricas do dia via GET /api/audit/daily-report
3. Verifique se ha alertas nao resolvidos (opcional)
4. Faca logout de todos os usuarios
5. Documente o resumo do dia

## 10. Criterios de Sucesso

O piloto e considerado bem-sucedido se:

- 90%+ dos alertas gerados sao acionaveis (nao sao falsos positivos)
- Transferencias executadas refletem a realidade fisica
- Politicas de estoque ajudam (nao atrapalham) a operacao
- Nao houve perda de dados ou inconsistencia grave
- Usuarios conseguiram operar sem treinamento extensivo
- Sistema nao apresentou downtime ou erros criticos
- Saldos de estoque no sistema divergem menos de 10% do real (contagem fisica)

## 11. Decisao Pos-Piloto

Apos o periodo, responder:

1. O sistema esta pronto para uso continuo? (Sim / Nao / Parcial)
2. Quais funcionalidades faltam? (lista priorizada)
3. Quais bugs foram encontrados? (lista com severidade)
4. O treinamento dos usuarios foi suficiente? (Sim / Nao)
5. Ha necessidade de ajustes nas politicas de estoque?
6. O desempenho foi aceitavel?
7. Ha risco em expandir para mais lojas/itens?

## 12. Contato e Suporte Durante o Piloto

- Suporte tecnico: [Nome / contato]
- Horario de suporte: [horario comercial / 24h]
- Cenario de emergencia: [procedimento / contato adicional]
