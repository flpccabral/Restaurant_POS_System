# Documentação do Projeto - POS Backend

Índice da documentação de implementação por fases.

---

## Fases Implementadas

### Fase 1: Multi-tenancy, Roles & Device Approval

Documentação completa da implementação da arquitetura multi-loja, sistema de roles e aprovação de dispositivos.

**Arquivos:**
- [PHASE1_IMPLEMENTATION.md](./PHASE1_IMPLEMENTATION.md) - Documentação detalhada da Fase 1

**Principais recursos:**
- Multi-tenancy com isolamento por `storeId`
- Sistema de roles com permissões dinâmicas
- Device approval com nicknames
- Session logging para auditoria

---

### Fase 2: Menu Builder & Recipe Engine

Documentação da implementação de fichas técnicas, gestão de estoque e ingredientes globais.

**Arquivos:**
- [PHASE2_IMPLEMENTATION.md](./PHASE2_IMPLEMENTATION.md) - Documentação detalhada da Fase 2

**Principais recursos:**
- Ingredientes globais (catálogo unificado)
- Fichas técnicas (receitas) com cálculo de custo
- Gestão de estoque por loja
- Alertas de reposição

---

### Fase 3: WebSockets & Comunicação em Tempo Real

Documentação da implementação de eventos em tempo real via Socket.io.

**Arquivos:**
- [PHASE3_IMPLEMENTATION.md](./PHASE3_IMPLEMENTATION.md) - Documentação detalhada da Fase 3
- [WEBSOCKETS.md](../WEBSOCKETS.md) - Catálogo completo de eventos WebSocket

**Principais recursos:**
- Notificações de pedidos em tempo real
- Atualizações de estoque automáticas
- Disponibilidade de produtos
- Alertas de estoque
- Aprovação de dispositivos

---

## Documentos Adicionais

| Documento | Descrição |
|-----------|-----------|
| [README.md](../README.md) | Visão geral do projeto |
| [QUICKSTART.md](../QUICKSTART.md) | Guia de início rápido |
| [MIGRATION_GUIDE.md](../MIGRATION_GUIDE.md) | Migração de dados |
| [WEBSOCKETS.md](../WEBSOCKETS.md) | Documentação de WebSockets |

---

## Scripts Úteis

| Script | Descrição |
|--------|-----------|
| `scripts/seed.js` | Seed completo de dados |
| `scripts/migrate-all.js` | Migração para multi-loja |
| `scripts/migration-cleanup.js` | Cleanup de migração |

---

## Testes

| Arquivo | Descrição |
|---------|-----------|
| `testes-api.sh` | Testes da Fase 1 |
| `testes-api-fase2.sh` | Testes da Fase 2 |

---

*Última atualização: 2026-05-21*
