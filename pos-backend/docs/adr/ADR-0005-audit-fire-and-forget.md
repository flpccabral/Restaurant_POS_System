# ADR-0005: Auditoria Operacional Fire-and-Forget (Não Bloqueante)

- Status: Accepted
- Date: 2026-06-15 (reconstituído — ver services/auditService.js)
- Decision owners: Arquiteto backend
- Related components: `services/auditService.js`, `models/operationalAuditLogModel.js`

## Context

O sistema registra ações operacionais críticas (transferências de estoque, compras, criação de políticas, resolução de alertas) para fins de auditoria, compliance e diagnóstico. É necessário decidir se uma falha no registro de auditoria deve impedir a operação principal de concluir.

## Decision

Implementar auditoria como operação fire-and-forget: o `auditService` captura qualquer exceção internamente e retorna `null` em caso de falha, sem relançar o erro para o chamador.

```javascript
// auditService.js — padrão implementado
const logAudit = async (params) => {
    try {
        const log = await OperationalAuditLog.create(params);
        return log;
    } catch (error) {
        console.error('[AuditService] Failed to log audit entry:', error.message);
        return null; // Não propaga o erro
    }
};
```

## Alternatives considered

1. **Auditoria bloqueante** — descartado pois uma falha de escrita no audit log impediria uma transferência de estoque real de concluir, causando impacto direto na operação do restaurante.
2. **Fila assíncrona (Bull/Redis)** — descartado por adicionar infraestrutura. Seria a abordagem correta em escala, mas é prematuro para o estágio atual.
3. **Auditoria em banco separado** — descartado por complexidade de infraestrutura.

## Consequences

### Positive

- Falha de auditoria nunca bloqueia operação crítica de negócio.
- Logs de erro no console permitem diagnóstico da falha de auditoria sem impacto ao usuário.
- Implementação simples e sem dependências adicionais.

### Negative

- Em caso de falha persistente do banco, ações podem ser executadas sem registro de auditoria.
- Não há retry — uma falha transiente não é retentada.
- Logs de falha de auditoria ficam apenas no console (sem alerta ativo).

## Risks and mitigations

| Risco | Mitigação |
|---|---|
| Ações executadas sem registro durante indisponibilidade do banco | Implementar health check que detecte falhas de escrita; alertar on-call |
| Falha silenciosa não detectada | Monitorar a taxa de `null` retornados pelo auditService |
| Compliance exige registro obrigatório | Reavaliar esta decisão caso requisitos regulatórios exijam garantia de auditoria |

## Validation

- Simular falha de escrita no MongoDB durante uma transferência — operação deve concluir com sucesso; log de erro deve aparecer no console.
- Registro de auditoria existe após transferência bem-sucedida.

## Supersedes

Nenhum.

## Superseded by

Nenhum.
