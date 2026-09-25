# Sistema de Módulos

## O que é

Módulo é uma funcionalidade extra que se pluga numa página de grupo.
Ex: **Pedidos** (carrinho + scanner), **Loja** (catálogo), **Transporte**
(mapa + geocoder).

O CSV de cada página tem uma coluna `ESTILO`. Se o valor for `loja`,
o card daquele estabelecimento ganha um botão "Comprar produtos". Se
for `transporte`, ganha "Solicitar corrida/frete".

## Como um módulo se registra

**API atual.** O registro passa por `Economizei.Cards`, não mais por
`Economizei.Modulos` (nome antigo, mantido só como referência
histórica).

Todo módulo faz, ao carregar, duas chamadas: uma pra registrar o
**botão de ação** no card e outra (opcional) pra registrar um **badge**
visual acima do título.

```js
// 1. Botão de ação no card
Economizei.Cards.registrarModulo('loja', {
  label:     'Ver produtos',           // texto do botão
  ariaLabel: 'Ver produtos da loja',   // rótulo de acessibilidade
  icone:     'fa-solid fa-store',      // classe Font Awesome
  onClick:   function (idx) {          // recebe o índice do card
    return 'Economizei.Loja.abrirModal(' + idx + ')';
  }                                    // retorna a STRING do onclick
});

// 2. Badge no topo do card (opcional)
Economizei.Cards.registrarBadge('loja', {
  label: 'Módulo Loja',
  icone: 'fa-solid fa-store',
  desc:  'Este estabelecimento oferece uma vitrine digital.'
});
```

### Regras da API

- O **primeiro argumento** é o `estilo` (mesmo valor da coluna `ESTILO`
  do CSV). É normalizado com `.toLowerCase().trim()` antes de ser
  guardado.
- `onClick` é uma função que recebe `idx` (índice do estabelecimento
  no array de dados) e retorna uma **string** com o código JS a ser
  executado no `onclick` inline do botão. Não é uma função a ser
  chamada direto.
- Só é possível registrar **um** módulo por estilo. Registrar de novo
  sobrescreve o anterior.
- `registrarBadge` exige `label`. `registrarModulo` exige `onClick`.

## Como o core usa

Ao renderizar cada card, o `grupos.js` consulta o registro:

```js
var modulo = modulosRegistrados[estilo];  // interno
if (modulo) {
  botoes.push(
    '<button class="btn-acao btn-modulo" data-modulo="' + estilo + '" ' +
    'onclick="' + modulo.onClick(idx) + '">' +
    '<i class="' + modulo.icone + '"></i> ' + modulo.label +
    '</button>'
  );
}
```

**O core não sabe o nome de nenhum módulo.** Só consulta o registro.

### Badges

Um módulo pode registrar também um **badge** — pílula pequena que
aparece acima do título do card, com tooltip. Serve pra sinalizar
visualmente que aquele estabelecimento tem aquele módulo disponível,
sem precisar abrir o card.

## Estrutura de arquivos

```
comum/
  utils.js            ← utilitários puros
  firebase.js         ← init do Firebase
  modulos.js          ← LEGADO. Sistema antigo de registro. Mantido
                         por compatibilidade, mas o registro hoje
                         acontece via Economizei.Cards.
  componentes.css     ← peças reutilizáveis (abas, cards, botões)
  modais.css          ← moldura do modal

grupos/
  grupos.js           ← core atual (contém registrarModulo/registrarBadge)
  grupos.css          ← CSS do layout de grupo (cards, filtros, busca)

modulos/
  _base.css           ← moldura específica de módulo
  loja.js             ← administração do painel lojista
  loja.css            ← estilos do painel lojista
  loja-publica.css    ← estilos da vitrine pública
  pedidos.js
  pedidos.css
  transporte.js
  transporte.css
  transporte-enderecos.js  ← modais auxiliares de endereço
```

## Como a página carrega

```html
<head>
  <link rel="stylesheet" href=".../comum/tokens.css">
  <link rel="stylesheet" href=".../grupos/grupos.css">
  <link rel="stylesheet" href=".../comum/modais.css">
  <link rel="stylesheet" href=".../comum/componentes.css">
</head>
<body>
  <!-- HTML da página (sem modal inline) -->

  <script src=".../comum/firebase.js"></script>
  <script src=".../comum/utils.js"></script>
  <script src=".../comum/modulos.js"></script>
  <script src=".../grupos/grupos.js"></script>

  <script>
    Economizei.Cards.configurar({ ... });
  </script>

  <!-- Módulos (um <script> por módulo que a página usa) -->
  <!-- Script público: carregar após grupos.js e antes de carregarDados(). -->
  <script src="https://cdn.jsdelivr.net/gh/contatoeconomizeirioclaro-ai/economizei-assets@main/js/economizei-loja.js"></script>

  <script>
    document.addEventListener('DOMContentLoaded', function () {
      Economizei.Cards.carregarDados();
    });
  </script>
</body>
```

## Estrutura que o módulo usa no HTML

Todo modal de módulo segue:

```html
<div class="modal-overlay" id="modalModuloX" role="dialog" aria-modal="true">
  <div class="modal-conteudo modal-modulo">
    <div class="modal-header">
      <div class="modal-estabelecimento-brand">
        <div class="modal-estabelecimento-logo">...</div>
        <div class="modal-estabelecimento-meta">
          <h3>Nome da Loja</h3>
          <span class="modal-estabelecimento-status status-aberta">Aceitando pedidos</span>
        </div>
      </div>
      <button class="modal-close-btn" aria-label="Fechar">×</button>
    </div>
    <div class="modal-body">…</div>
    <div class="modal-footer">…</div>
  </div>
</div>
```

**Variantes de largura:**

- `modal-conteudo modal-modulo` — modal de tamanho médio (padrão)
- `modal-conteudo modal-modulo modal-modulo-wide` — médio em desktop, mais largo
- `modal-conteudo fullscreen` — tela cheia (Loja, Pedidos, Transporte)

## Peças disponíveis em componentes.css

O módulo pode usar sem redefinir:

- **Identidade de loja:** `.modal-estabelecimento-brand`, `.modal-estabelecimento-logo`, `.modal-estabelecimento-meta`, `.modal-estabelecimento-status` (com `.status-aberta`, `.status-pausada`, `.status-fechada`)
- **Banner de status:** `.status-loja-banner`
- **Abas:** `.modal-tabs`, `.modal-tab`, `.modal-tab-content`, `.cart-tab-badge`
- **Grid de produtos:** `.produtos-grid`, `.produto-card`, `.produto-nome`, `.produto-preco`
- **Categorias:** `.categoria-group`, `.categoria-titulo-modal`
- **Carrinho:** `.item-carrinho`, `.item-carrinho-imagem`, `.qtd-item`, `.carrinho-layout`, `.carrinho-col-esquerda`, `.carrinho-col-direita`
- **Formulário:** `.input-pedido`, `.form-row`, `.sem-troco-label`
- **Botões:** `.btn-pedido-cta`, `.btn-escolher`, `.btn-adicionar-simples`, `.btn-aplicar-cupom`, `.btn-consultar-pedido`, `.btn-limpar-historico`, `.btn-selecionar-sabor`, `.btn-tamanho-modal`, `.btn-pequeno`, `.btn-escanear-mesa`
- **Popup confirmação:** `.popup-confirmacao`, `.popup-confirmacao-card`, `.popup-confirmacao-header`, `.popup-confirmacao-body`, `.popup-confirmacao-codigo`, `.popup-confirmacao-botoes`, `.popup-confirmacao-footer`
- **Badge no card:** `.badge-modulo-slot`, `.badge-modulo-card`

## Barra inferior do app

O `_base.css` define a variável `--reserva-barra-app` que muda quando
o body tem classe `modo-app`. Os modais de módulo consomem essa
variável pra não encostar na barra nativa. **Não redefinir essa
variável em `modulos/*.css`.**

## O que vai em cada arquivo

| Arquivo | Responsabilidade |
|---|---|
| `comum/modais.css` | Moldura genérica de qualquer modal (overlay, header, footer, X, tons) |
| `comum/componentes.css` | Peças reutilizáveis dentro de módulos (abas, cards, botões) |
| `modulos/_base.css` | Moldura específica de módulo (largura, fullscreen, barra do app) |
| `modulos/loja.css` | Estilos do painel lojista |
| `modulos/loja-publica.css` | Interface pública da vitrine Loja |
| `modulos/*.css` | Só o que é exclusivo daquele módulo |
| `comum/modulos.js` | (legado) sistema de registro antigo — não usar em código novo |
| `grupos/grupos.js` | Core atual — contém `registrarModulo`, `registrarBadge`, `configurar`, `carregarDados` |
| `modulos/*.js` | Lógica + HTML do modal de cada módulo |
