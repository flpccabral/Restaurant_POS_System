# POS Admin P1 — Dashboard e Settings premium

## Meta
- **Objetivo:** Elevar visualmente as telas principais `Dashboard` e `Settings` do `pos-admin` após o P0 de fundação responsiva, tornando-as mais premium, operacionais e alinhadas a um SaaS brasileiro de restaurante/POS.
- **Tipo:** frontend / UI premium / UX refinement
- **Projeto alvo:** `pos-admin` apenas.
- **Arquivo(s) alvo prováveis:**
  - `pos-admin/src/app/(dashboard)/page.tsx`
  - `pos-admin/src/app/(dashboard)/settings/page.tsx`
  - `pos-admin/src/components/kpi-card.tsx`
  - `pos-admin/src/components/ui/card.tsx` somente se necessário e sem quebrar outras telas
- **Dependências:** P0 já aprovado: tipografia sans-serif, sidebar/header responsivos, overflow mobile zerado.

## Contexto
- Design review concluiu que o `pos-admin` era funcional, mas genérico e não-premium.
- P0 já corrigiu a fundação: fonte, shell responsivo, drawer mobile, microcopy crítica e overflow horizontal.
- P1 deve melhorar produto/visual sem recomeçar do zero.
- Screenshots finais P0 para comparação:
  - `/tmp/pos-admin-audit/dashboard-auth.png`
  - `/tmp/pos-admin-audit/settings-auth.png`
  - `/tmp/pos-admin-audit/dashboard-mobile.png`
  - `/tmp/pos-admin-audit/settings-mobile.png`

## Restrições
- Não alterar backend.
- Não alterar `pos-frontend`.
- Não alterar autenticação, API contracts ou persistência.
- Não alterar package.json/package-lock.
- Não trocar biblioteca de UI.
- Não introduzir dependência nova.
- Não fazer P2/polimento amplo, dark mode novo, animações complexas ou redesign da navegação global.
- Não remover funcionalidades existentes.
- Manter `/settings` funcionando e salvando `paymentProcessing`.
- Manter Dashboard consumindo os mesmos serviços atuais.

## Estado atual observado
### Dashboard
- `src/app/(dashboard)/page.tsx` tem:
  - header simples com título + período;
  - 4 KPIs via `KpiCard`;
  - 3 métricas secundárias;
  - 2 gráficos;
  - 2 tabelas.
- Problemas visuais ainda presentes:
  - hierarquia fraca;
  - dashboard parece template genérico;
  - KPIs poderiam ser mais operacionais;
  - cards têm pouca narrativa;
  - textos ainda têm alguns problemas, ex: `Ticket medio`, `inventario`, `minimo`.

### Settings
- `src/app/(dashboard)/settings/page.tsx` tem:
  - card único `Processamento de Pagamentos` com largura `max-w-3xl`;
  - seleção Gateway vs Offline;
  - checkbox nativo para documento POS;
  - métodos habilitados;
  - botão salvar/restaurar.
- Problemas visuais:
  - tela estreita demais em desktop;
  - falta narrativa administrativa;
  - modo offline deveria explicar impacto no PDV;
  - cards de modo deveriam comunicar consequências operacionais;
  - ação primária deveria ser mais clara;
  - checkbox nativo destoa visualmente.

## Saída Esperada
### Dashboard P1
- [ ] Header mais operacional/premium:
  - título + subtítulo melhores;
  - seletor de período integrado de forma mais refinada;
  - pelo menos um bloco/resumo contextual do estado da operação, sem inventar dados inexistentes.
- [ ] KPIs mais fortes:
  - valores com hierarquia maior;
  - microcopy PT-BR corrigida;
  - ícones/cores semânticos consistentes;
  - layout mobile continua sem overflow.
- [ ] Métricas secundárias com melhor organização:
  - `Valor em Estoque`, `CMV`, `Impostos` devem parecer painéis úteis, não cards soltos.
  - Corrigir acentos: `inventário`, `mínimo`, `Ticket médio`.
- [ ] Gráficos e tabelas com melhor apresentação:
  - headers com descrição curta;
  - estados vazios mais claros;
  - evitar excesso de cor; usar tokens semânticos.
- [ ] Não reestruturar chamadas de API, apenas apresentação.

### Settings P1
- [ ] Layout desktop em duas áreas/colunas quando houver espaço:
  - área principal de configuração;
  - área lateral/resumo/impacto operacional.
- [ ] Cards de modo de pagamento mais explicativos:
  - Gateway Mercado Pago: processa Pix/cartão no sistema;
  - Offline / Maquininha externa: pagamento ocorre fora; exigir NSU/TXID/documento quando configurado; não muda caixa físico para pagamentos digitais.
- [ ] Estado ativo mais claro e sem hardcoded amber se houver token semântico adequado.
- [ ] Checkbox/toggle de documento POS visualmente integrado ao design system.
- [ ] Botão primário destacado; rodapé de ações claro.
- [ ] Mobile continua sem overflow horizontal.

## Critérios de Verificação
- [ ] `cd pos-admin && npx eslint src/app/'(dashboard)'/page.tsx src/app/'(dashboard)'/settings/page.tsx src/components/kpi-card.tsx src/components/ui/card.tsx` → 0 errors. Warnings preexistentes podem ser documentados, mas não introduzir erros.
- [ ] `cd pos-admin && npm run build` passa.
- [ ] Medir DOM mobile em `/` e `/settings`: `overflowX === 0` e sidebar fixa não visível em mobile.
- [ ] Capturar screenshots finais:
  - dashboard desktop;
  - settings desktop;
  - dashboard mobile;
  - settings mobile.
- [ ] Não alterar backend nem `pos-frontend`.

## Notas para o Builder
- Evoluir com design premium, não reescrever tudo.
- Use tokens semânticos existentes: `brand`, `success`, `warning`, `critical`, `info`, `muted`, `foreground`, `card`, `border`.
- Evite hardcoded colors quando houver token semântico equivalente.
- Não adicione componentes grandes se os existentes bastam.
- Preserve dados reais: não inventar KPIs ou números. Pode criar textos/labels/resumos baseados nos dados já disponíveis.
- Cuidado com Recharts em mobile: não criar containers que gerem overflow.
- Se tocar `Card` global, evite regressão em todas as telas. Preferir ajustar por classe local quando possível.

## Resultado
- **Status:** pendente
- **Build:** pendente
- **Divergências:** pendente
- **Próximos passos:** após P1 aprovado, considerar P2 polimento/login/estados vazios/warnings.
