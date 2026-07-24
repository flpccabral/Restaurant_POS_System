# POS Frontend P0 — Fundação visual e responsiva operacional

## Meta
- **Objetivo:** Corrigir os bloqueadores visuais/responsivos do `pos-frontend` para torná-lo utilizável em mobile/tablet e mais coerente com um PDV operacional brasileiro.
- **Tipo:** frontend / UI foundation / responsividade
- **Projeto alvo:** `pos-frontend` apenas.
- **Arquivos alvo prováveis:**
  - `pos-frontend/src/pages/Auth.jsx`
  - `pos-frontend/src/pages/Menu.jsx`
  - `pos-frontend/src/components/pdv/PdvFooterActions.jsx`
  - `pos-frontend/src/pages/Dashboard.jsx` somente correções P0, não redesign admin completo
  - componentes relacionados se necessário: `Header.jsx`, `MenuContainer.jsx`, `Bill.jsx`, `CartInfo.jsx`
- **Dependências:** Backend local em `:8000` e Vite em `:5173` para verificação visual autenticada.

## Contexto de auditoria
- Capturas reais geradas em `/tmp/pos-frontend-audit/`:
  - `auth-desktop.png`, `auth-mobile.png`
  - `menu-desktop.png`, `menu-mobile.png`
  - `orders-mobile.png`, `tables-mobile.png`
  - `dashboard-desktop.png`, `dashboard-mobile.png`
  - `kitchen-desktop.png`
- Build atual passa: `npm run build`.
- Lint global atual falha por erros preexistentes em massa: `273 errors / 5 warnings` (`React` unused, prop-types, etc.). P0 não precisa corrigir lint global inteiro.
- O `pos-admin` já recebeu P0/P1; não copiar layout admin. O `pos-frontend` é PDV/operacional.

## Problemas bloqueadores encontrados
1. **Login mobile quebrado**
   - Evidência: `/tmp/pos-frontend-audit/auth-mobile.png`.
   - `Auth.jsx` mantém duas colunas `w-1/2` no mobile, comprimindo imagem/frase e formulário.
2. **PDV/Menu mobile desktop-first**
   - Evidência: `/tmp/pos-frontend-audit/menu-mobile.png`.
   - `Menu.jsx` usa painel esquerdo fixo `w-[380px]`, ocupando quase toda viewport; produtos ficam fora da área útil.
3. **Footer operacional cortado no mobile**
   - `PdvFooterActions.jsx` renderiza 7 botões em `justify-around`; labels como `Imprimir`/`Pre-venda` cortam visualmente.
   - Medição DOM mostrou elementos fora da área útil embora `scrollWidth` seja 390 por containment.
4. **Dashboard mobile impróprio**
   - Evidência: `/tmp/pos-frontend-audit/dashboard-mobile.png`.
   - Cards/tabs/botões apertados; textos e valores cortados.
5. **Microcopy PT-BR incompleta**
   - Exemplos: `Metricas`, `Concluido`, `Ultimos 30 Dias`, `Nenhum produto disponivel`, `Observacao`, `Expedicao`, `ATENCAO`.

## Restrições
- Não alterar backend.
- Não alterar `pos-admin`.
- Não alterar package.json/package-lock.
- Não introduzir dependência nova.
- Não trocar React Router, Redux ou arquitetura de API.
- Não fazer redesign premium completo P1.
- Não remover funcionalidades existentes de PDV, caixa, impressão, mesas, comandas, KDS.
- Não tentar resolver os 273 erros de lint globais fora dos arquivos tocados.

## Saída esperada — P0
### Login
- [ ] Mobile deve virar layout de uma coluna funcional ou empilhado, sem duas colunas `w-1/2` comprimidas.
- [ ] Desktop deve preservar impacto visual da imagem/frase.
- [ ] Formulário legível em 390px, sem corte horizontal.

### PDV/Menu
- [ ] Mobile deve priorizar produtos/categorias e não prender a tela no carrinho fixo de 380px.
- [ ] Solução aceitável: carrinho como drawer/bottom sheet/área recolhível no mobile; desktop pode manter dois painéis.
- [ ] Produtos e categorias devem estar visíveis/usáveis em 390px.
- [ ] Desktop não deve regredir.

### Footer operacional
- [ ] Mobile deve evitar labels cortados e botões fora da área útil.
- [ ] Soluções aceitáveis: scroll horizontal explícito, grid compacto, esconder labels secundários, reduzir botões prioritários com overflow controlado.
- [ ] Estado ativo continua claro.

### Dashboard
- [ ] Corrigir apenas P0 mobile: cards devem empilhar ou usar grid legível; tabs/action buttons com scroll/empilhamento sem texto cortado.
- [ ] Corrigir acentos principais: `Métricas`, `Últimos 30 Dias`, etc.
- [ ] Não transformar em dashboard admin premium; isso pertence ao `pos-admin` em P1/P2.

### Microcopy crítica
- [ ] Corrigir acentos nas telas tocadas, sem varrer projeto inteiro.
- [ ] Manter linguagem operacional: PDV, Comanda, Mesa, Caixa, Delivery, Impressão.

## Critérios de verificação
- [ ] `cd pos-frontend && npm run build` passa.
- [ ] ESLint nos arquivos tocados deve ter `0 errors` ou, se impossível por regras preexistentes de `React`/prop-types, documentar exatamente quais erros já existiam e não introduzir novos.
- [ ] Capturar screenshots autenticadas desktop/mobile:
  - `/auth`, `/menu`, `/orders`, `/tables`, `/dashboard`, `/kitchen`.
- [ ] Medir mobile 390×844:
  - `document.documentElement.scrollWidth - document.documentElement.clientWidth === 0` em `/auth`, `/menu`, `/orders`, `/tables`, `/dashboard`, `/kitchen`.
  - Também inspecionar visualmente se não há conteúdo útil escondido por `overflow-hidden`.
- [ ] Confirmar que backend, `pos-admin` e package files não foram alterados.

## Notas para o Builder
- Este P0 é sobre **fundação**, não “embelezar tudo”.
- O maior risco é `Menu.jsx`: preservar fluxo de pedido e carrinho, mas tornar mobile utilizável.
- Evitar hardcoded mágico novo quando classes responsivas Tailwind resolvem.
- Se mudar `PdvFooterActions`, testar em pelo menos `/menu`, `/orders`, `/tables`.
- Screenshots podem usar login `admin@pos.com` / `admin123` se backend local estiver com seed compatível.

## Resultado
- **Status:** aprovado após validação independente.
- **Build:** `cd pos-frontend && npm run build` passou.
- **Lint:** arquivos P0 principais passaram; `KitchenDisplay.jsx` mantém erros `react/prop-types` preexistentes documentados, sem campanha de correção neste P0.
- **Overflow mobile:** `/menu`, `/`, `/orders`, `/tables`, `/dashboard`, `/kitchen` com `overflowX=0` e `overflowing=0` em 390×844 na captura final.
- **Screenshots finais:** `/tmp/pos-frontend-p0-approved-20260722-224254/` e login limpo em `/tmp/pos-frontend-p0-final-20260722-223604/auth-mobile-clean.png`.
- **Divergências:** nenhuma bloqueante; lint global do projeto continua fora do escopo por erros preexistentes.
- **Próximos passos:** criar P1 para polimento visual operacional do PDV desktop/KDS e eventual separação/migração de responsabilidades administrativas para `pos-admin`.
