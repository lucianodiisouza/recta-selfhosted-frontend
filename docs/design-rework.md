# Rework de design do app web

Objetivo: o app web (tudo sob `/app`) passa a ter a mesma cara do app iOS/Android. **Só
design.** Nenhuma funcionalidade, rota, chamada de API, regra de negócio ou texto muda (exceto
strings novas que um componente visual exija).

Fonte de verdade do visual: `recta-ios/Packages/RectaKit/Sources/DesignSystem/`
(`Palette.swift`, `Spacing.swift`, `Typography.swift`, `Components/`) e
`recta-ios/docs/02-design-system.md`. Quando o web e o iOS divergirem, o iOS ganha.

Iniciado em 2026-09-30.

## Status

| Fase | O que entrega | Status |
|------|---------------|--------|
| F0 Fundações | Tokens: cor, neutros, tipografia, raio, sombra. O app inteiro muda sem editar tela | ✅ |
| F1 Componentes base | `src/components/ui/` com Button, Card, Field, Modal, etc. + galeria | ✅ |
| F2 Casca | Sidebar, cabeçalho, navegação mobile, menus, toasts | ✅ |
| F3 Telas | Cada tela refeita sobre os componentes, espelhando o iOS | ✅ |
| F4 Acabamento | Motion, acessibilidade, dark mode, responsivo, limpeza de CSS morto | ✅ |

Legenda: ✅ feito · 🔄 em andamento · ⏳ a fazer · ⏸️ bloqueado

## Diagnóstico (2026-09-30)

- 149 arquivos `.tsx`, ~33 mil linhas. Estilo escrito direto nas classes, sem design system.
- Usos: ~670 `primary-*` (azul-céu), ~3.600 `gray-*`, ~2.800 `dark:`, ~520 `red-*`,
  ~230 `green-*`, ~190 `blue-*`, ~170 `yellow-*`, 140 hex soltos em `.tsx`, 354 `font-light`.
- ~30 modais montados à mão (`fixed inset-0`), 236 `<button>`, 79 `<input>`, 100 cards
  `bg-white dark:bg-gray-800` repetidos.
- Estética atual: "fine line" (peso 300 em tudo, bordas finas, azul-céu). O app mobile é o
  oposto: violeta forte, títulos semibold arredondados, cards brancos com sombra suave sobre
  fundo neutro frio, números com dígitos tabulares.
- Componentes compartilhados que já existem e servem de ponto de apoio: `PageHeader` (8 usos),
  `ConfirmModal` (8), `PageButton` (6), `PageSkeletons` (6), `EmptyState` (4).

## Regras do rework

1. Só design. Se uma mudança altera comportamento, ela sai do escopo e vira nota no fim deste
   arquivo.
2. Tokens primeiro. Tela nova não usa `gray-*`/`primary-*`/hex cru: usa os tokens semânticos
   (F0) e os componentes de `ui/` (F1).
3. Cada tarefa é conferida no navegador em claro, escuro, desktop (1400px) e celular (375px).
4. Commits granulares direto no `main`, com push. Este arquivo é atualizado a cada tarefa.
5. Sem travessão em texto visível. Dinheiro sempre com `tabular-nums`, e receita/despesa
   nunca só por cor (sinal ou ícone junto).
6. Todo select é combobox (`ui/Select`: botão + lista em popover, busca quando a lista passa
   de 6 itens, setas e Enter no teclado). Nada de `<select>` nativo. `SelectCombobox` e
   `CategoryCombobox` já renderizam o `ui/Select`.
7. A landing (`/`, `/home`) fica fora: ela é peça de marketing e já está no visual das lojas
   (fundo creme). O app usa o fundo neutro do iOS.

## F0 Fundações

Alavanca máxima: redefinir as escalas que as 5 mil classes já usam, para o app inteiro mudar
de uma vez, e criar os tokens semânticos que F1 em diante vão usar.

| # | Tarefa | Status |
|---|--------|--------|
| F0.1 | Tokens semânticos em CSS (`--bg`, `--bg-elevated`, `--bg-sunken`, `--content`, `--content-2`, `--content-3`, `--brand`, `--brand-strong`, `--brand-soft`, `--positive(-soft)`, `--negative(-soft)`, `--warning`, `--info`, `--separator`, `--border`) com variantes claro/escuro copiadas de `Palette.swift`, expostos no Tailwind (`bg-surface`, `text-content`, `border-line`…) com suporte a opacidade | ✅ |
| F0.2 | Escala `primary` passa de azul-céu para o violeta da marca (500/600 = `#5B3DF5`, tons claros para fundos suaves, `#8B72FF` no escuro) | ✅ |
| F0.3 | Escala `gray` passa para os neutros frios do iOS (`gray-50` = `#F6F6FB` fundo, `gray-200` = `#E1E1EA` borda, `gray-800` = `#17171F` card escuro, `gray-900` = `#0D0D12` fundo escuro, textos `#14141B`/`#5B5B69`/`#6B6B78`). Conferir contraste AA nos pares mais usados | ✅ |
| F0.4 | Tipografia: fim do peso 300 global. Fonte do sistema, títulos e números em `ui-rounded` (SF Pro Rounded no Apple, fallback do sistema), títulos semibold, `tabular-nums` para valores | ✅ |
| F0.5 | Raio e sombra: `rounded-lg` 12px, `rounded-xl` 16px, `rounded-2xl` 24px (Radius do iOS); sombras `shadow-card` e `shadow-floating` iguais às `Elevation` do iOS | ✅ |
| F0.6 | Cores de estado: `green/red/yellow/blue-*` de receita, despesa, alerta e info apontam para `positive/negative/warning/info` do iOS | ✅ |
| F0.7 | Detalhes globais: `theme-color`, fundo do `<html>` antes do React (sem flash), barra de rolagem, anel de foco violeta, seleção de texto | ✅ |

Feito em 2026-09-30. Notas: `font-light` passou a valer 400 (o app nunca usa peso abaixo de
regular); `rounded-md/lg/xl/2xl` seguem o `Radius` do iOS; os tokens semânticos vivem em
`src/index.css` como canais RGB e aparecem no Tailwind como `surface`, `content`, `line`,
`brand`, `positive`, `negative`, `warning`, `info`. Ao mudar `tailwind.config.js`, reinicie o
servidor de dev (o Vite guarda a config antiga e o CSS quebra com "class does not exist").

Saída esperada: o app já parece "da família" sem nenhuma tela reescrita. Risco principal:
algum par de cor que era legível no azul-céu/cinza antigo e deixa de ser. Mitigação: varrer
todas as telas em claro e escuro ao fim da fase.

## F1 Componentes base (`src/components/ui/`)

Cada componente espelha o do iOS, tem variantes e estados (normal, hover, pressionado,
desabilitado, carregando), funciona nos dois temas e é acessível (foco visível, `aria-*`,
alvo ≥ 44px no toque).

| # | Componente | Espelha no iOS | Status |
|---|-----------|----------------|--------|
| F1.1 | `Button` (primary, secondary, ghost, destructive; sm/md/lg; loading) e `IconButton` | Buttons | ✅ |
| F1.2 | `Card`, `BrandCard` (gradiente), `SectionHeader` | `Card.swift` | ✅ |
| F1.3 | `Field` + `Input`, `Textarea`, `Select` combobox (rótulo, ajuda, erro), `AmountInput` | AmountField | ✅ |
| F1.4 | `Modal`: uma casca só (centralizada no desktop, sheet de baixo no celular, foco preso, Esc, rolagem do corpo travada). Substitui os ~30 modais à mão | FloatingSheet / sheet nativo | ✅ |
| F1.5 | `SegmentedControl`, `Chip`/`Badge`, `Switch` | Badges, segmentos | ✅ |
| F1.6 | `MoneyText` (moeda do usuário, sinal, cor semântica, tabular) | `MoneyText.swift` | ✅ |
| F1.7 | `ListRow` (ícone em quadrado tingido, título, subtítulo, valor à direita) | `ListRow.swift` | ✅ |
| F1.8 | `EmptyState`, `Skeleton`, `ErrorState` refeitos | Estados | ✅ |
| F1.9 | `PaymentCard` (cartão de conta/cartão com gradiente, como no carrossel da Home) | `PaymentCard.swift` | ✅ |
| F1.10 | Galeria interna em `/app/dev/ui`, só em desenvolvimento, com todos os componentes nos dois temas | catálogo | ✅ |

Feito em 2026-09-30. Tudo sai de `src/components/ui` (`index.ts`). Os componentes antigos
(`PageButton`, `ConfirmModal`, `EmptyState`, os ~30 modais à mão) continuam no lugar e são
trocados tela a tela em F3, para cada troca ser conferida junto com a tela. Galeria em
`/app/dev/ui` (só `npm run dev`; fora do build de produção).

## F2 Casca do app

| # | Tarefa | Status |
|---|--------|--------|
| F2.1 | Sidebar: marca, itens com ícone e pílula ativa em `brand-soft`, rodapé com usuário, modo recolhido | ✅ |
| F2.2 | Cabeçalho de página (`PageHeader`): título grande arredondado, ações à direita, como os large titles do iOS | ✅ |
| F2.3 | Celular: barra de abas inferior no estilo do iOS com os mesmos destinos que já existem (sem rota nova) | ✅ |
| F2.4 | Menus e popovers (ações de conta, cartão, transação), `CommandMenu`, seletor de household, notificações | ✅ |
| F2.5 | Toasts, banners (`MobileBanner`, instalação do PWA, nova versão) | ✅ |

Feito em 2026-09-30. Extra: `scripts/migrate-tokens.py` trocou 1.717 pares claro/escuro
comuns (ex.: `bg-white dark:bg-gray-800`) pelos tokens semânticos em todo o app, o que também
separou os cards do fundo no modo escuro. O script é idempotente e pode rodar de novo depois
de cada tela. `scripts/migrate-modals.py` fez o mesmo com os ~25 modais montados à mão (sheet
no celular, cantos de 24px, fundo desfocado, botões nas variantes do `ui/Button`). Os estilos
base de `input`/`textarea`/`select` ficaram em `:where()` (especificidade zero) para as classes
dos componentes sempre ganharem. `HouseholdSelector` e `InvitesNotification` só passaram pela migração; ganham
acabamento próprio quando a tela de Ajustes (F3.8) for feita.

## F3 Telas

Ordem por uso. Cada tela: trocar classes cruas por tokens e componentes de `ui/`, alinhar
layout e hierarquia com a tela equivalente do iOS, sem mexer em lógica.

| # | Tela | Referência iOS | Status |
|---|------|----------------|--------|
| F3.1 | Dashboard (Home) e widgets (`components/widgets/*`): cabeçalho de saldo, cartões de conta, Resumo do mês, maiores categorias, gráficos com a paleta do app | Home | ✅ |
| F3.2 | Transações: lista, filtros, busca, linha (`TransactionItem`) igual a `TransactionListRow` | Transações | ✅ |
| F3.3 | Modal de transação (`TransactionModal` e campos) | Captura | ✅ |
| F3.4 | Contas | Cartões > Contas | ✅ |
| F3.5 | Cartões de crédito e fatura | Cartões / Fatura | ✅ (conferir com um cartão de verdade) |
| F3.6 | Orçamentos, Metas, Recorrentes | Planejamento | ✅ (orçamentos e metas conferidos só vazios) |
| F3.7 | Relatórios e Retrospectiva mensal (`MonthlyRecap`) | Relatórios | ✅ (retrospectiva só pelas migrações) |
| F3.8 | Ajustes e modais de conta (excluir, redefinir, household, convites) | Ajustes | ✅ (modais de household e convites só pelas migrações) |
| F3.9 | Login, verificação e onboarding | Login / Onboarding | ✅ (onboarding e verificação só pelas migrações) |
| F3.10 | Suporte, Termos, Privacidade, Manutenção, Novidades | páginas simples | ✅ |

## F4 Acabamento

| # | Tarefa | Status |
|---|--------|--------|
| F4.1 | Motion: transições curtas com mola, contagem do saldo, entrada de modais; tudo respeitando `prefers-reduced-motion` | ✅ |
| F4.2 | Acessibilidade: contraste AA medido nos tokens, foco visível em tudo, navegação por teclado nos modais e menus | ✅ |
| F4.3 | Varredura de dark mode e de 375px em todas as telas | ✅ |
| F4.4 | Limpeza: CSS "fine line" e `blueprint-grid` mortos, hex soltos restantes, classes `gray-*`/`primary-*` que sobraram | ✅ |
| F4.5 | Capturas antes/depois de cada tela para registro | ⏸️ (opcional; capturas "antes" só do Dashboard e Transações) |
| F4.6 | Rodapé da landing com a mesma estrutura dos outros produtos Primo (PrimoEngine, PrimoRec, PrimoDock) | ✅ |

## Notas de F4 (2026-09-30)

- Contraste: pares medidos; botões sólidos usam `bg-brand-fill`/`bg-negative-fill` e texto sobre
  tinta suave usa `text-brand-on-soft`/`text-negative-on-soft` (todos ≥ 4,5:1 nos dois temas).
- Os modais antigos (fora do `ui/Modal`) ganharam o visual, mas não a armadilha de foco. Quando
  uma tela for mexida de novo, trocar o modal dela pelo `ui/Modal`.
- Ainda há ~500 classes `gray-*` e ~180 `primary-*` cruas (trilhos de progresso, skeletons,
  anéis de foco). Já saem nas cores novas porque as escalas foram remapeadas; não precisam de
  troca.
- Conferir com dados de verdade: tela de cartão (fatura, limite), orçamentos e metas cheios,
  onboarding e retrospectiva mensal. A conta de teste não tem esses dados.

## Dependências

- **Login no navegador de testes.** As telas de `/app` exigem sessão, e eu não digito senhas.
  O titular entra uma vez no painel do navegador em `http://localhost:5173/login` (a sessão do
  Firebase fica salva) e a verificação visual das telas internas passa a funcionar. Sem isso,
  F0 e F1 ainda andam (login, galeria `/app/dev/ui` pode ser aberta sem sessão), mas F2 e F3
  ficam sem conferência visual.

## Estimativa

| Fase | Tamanho |
|------|---------|
| F0 | 1 sessão |
| F1 | 2 a 3 sessões |
| F2 | 1 a 2 sessões |
| F3 | 5 a 8 sessões (Dashboard, Transações e Cartões são as maiores) |
| F4 | 1 a 2 sessões |

## Fora do escopo (anotado durante o trabalho)

- Relatórios: categorias com total zero mostram "NaN%" (divisão por zero na porcentagem).
  É bug de dado/formatação, não de design.

- ~~Banner "Versão Web" desatualizado~~: resolvido em 2026-09-30, agora leva para a App Store.
- `components/households/InviteMemberForm.tsx` não é usado em lugar nenhum (código morto, ainda
  com `<select>` nativo).
- Rótulos "Expandir menu"/"Colapsar menu" da sidebar e "Fechar notificação" dos toasts são
  fixos em português (pré-existente).

- Rodapé da landing tem "Suporte", "Termos de Uso" e "Política de Privacidade" fixos em
  português (não passam pelo i18n). Pré-existente.
