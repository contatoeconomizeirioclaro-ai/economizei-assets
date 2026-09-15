# Sistema de Módulos

## O que é

Módulo é uma funcionalidade extra que se pluga numa página de grupo.
Ex: **Pedidos** (carrinho + scanner), **Loja** (catálogo), **Transporte**
(mapa + geocoder).

O CSV de cada página tem uma coluna `ESTILO`. Se o valor for `loja`,
o card daquele estabelecimento ganha um botão "Comprar produtos". Se
for `transporte`, ganha "Solicitar corrida/frete".

## Como um módulo se registra

Todo módulo faz, ao carregar:

```js
Economizei.Modulos.registrar({
  id:     'loja',                    // identificador único
  estilo: 'loja',                    // casa com a coluna ESTILO
  rotulo: 'Comprar produtos',        // texto do botão no card
  icone:  'fa-cart-shopping',        // classe Font Awesome
  classe: 'btn-modulo',              // classe visual do botão
  abrir:  function (idx) { ... },    // abre o modal
  fechar: function () { ... }        // fecha o modal
});
```

O core, ao renderizar cada card, faz:

```js
var modulo = Economizei.Modulos.paraEstilo(estilo);
if (modulo) {
  botoes.push(
    '<button class="btn-acao ' + modulo.classe + '" ' +
    'onclick="Economizei.Modulos.abrir(\'' + modulo.id + '\', ' + idx + ')">' +
    '<i class="fa-solid ' + modulo.icone + '"></i> ' + modulo.rotulo +
    '</button>'
  );
}
```

**O core não sabe o nome de nenhum módulo.** Só consulta o registro.

## Estrutura de arquivos

```
comum/
  modulos.js          ← sistema de registro
  componentes.css     ← peças reutilizáveis (abas, cards, botões)
  modais.css          ← moldura do modal

modulos/
  _base.css           ← moldura específica de módulo
  loja.js             ← módulo Loja
  loja.css            ← CSS específico do Loja
  pedidos.js
  pedidos.css
  transporte.js
  transporte.css
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
  <script src=".../js/economizei-core.js"></script>

  <script>
    Economizei.Cards.configurar({ ... });
  </script>

  <!-- Módulos (um <script> por módulo que a página usa) -->
  <script src=".../modulos/loja.js"></script>

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
      <!-- Bloco de identidade da loja (logo + nome + status) -->
      <div class="modal-estabelecimento-brand">
        <div class="modal-estabelecimento-logo">...</div>
        <div class="modal-estabelecimento-meta">
          <h3>Nome da Loja</h3>
          <span class="modal-estabelecimento-status status-aberta">Aceitando pedidos</span>
        </div>
      </div>
      <button class="modal-close-btn" aria-label="Fechar">×</button>
    </div>
    <div class="modal-body">
      <!-- conteúdo do módulo -->
    </div>
    <div class="modal-footer">
      <!-- ações do módulo -->
    </div>
  </div>
</div>
```

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
| `modulos/*.css` | Só o que é exclusivo daquele módulo |
| `comum/modulos.js` | Sistema de registro |
| `modulos/*.js` | Lógica + HTML do modal de cada módulo |