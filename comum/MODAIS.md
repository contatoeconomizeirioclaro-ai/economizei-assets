# Sistema de modais

Base compartilhada para os modais do site. Depende de `tokens.css`.

## Estrutura base

Todo modal usa esta estrutura:

```html
<div class="modal-overlay" id="modalX" role="dialog" aria-modal="true" aria-labelledby="tituloX">
  <div class="modal-conteudo">
    <div class="modal-header">
      <h3 id="tituloX">Título</h3>
      <button class="modal-close-btn" aria-label="Fechar">×</button>
    </div>
    <div class="modal-body">…</div>
    <div class="modal-footer">
      <button class="btn-modal-fechar">Fechar</button>
    </div>
  </div>
</div>
```

## Estado de visibilidade

Todo overlay de modal usa exclusivamente a classe **`active`** para abrir e fechar:

```javascript
modal.classList.add('active');    // abrir
modal.classList.remove('active'); // fechar
```

O estado fechado é o padrão (`.modal-overlay { display: none; }`) e o estado aberto
é definido por `.modal-overlay.active { display: flex; }` em `tokens.css`. Não use
`ativo`, `style="display: flex"`, `style="display: none"` ou alternâncias entre
classes e estilos inline para controlar a visibilidade. Para modais que precisam
de foco preso e fechamento por `Escape`, use `EconomizeiUtils.criarModalAcessivel()`;
ele já aplica a mesma convenção.

## Como escolher

Cada modal combina **um tamanho** + **uma família** (opcional) + **um tom** (opcional).

### Tamanhos
| Classe | Largura máx | Uso |
|---|---|---|
| *(padrão)* | 480px | Maioria dos casos |
| `modal-sm` | 360px | Confirmações curtas |
| `modal-lg` | 640px | Listas longas, formulários |
| `modal-xl` | 860px | Conteúdo extenso |

### Famílias
| Classe | Quando usar |
|---|---|
| `modal-confirmar` | Aviso/confirmação — mensagem centralizada, botões simétricos |
| `modal-lista` | Lista de opções clicáveis — itens com `.item-opcao` |
| `modal-midia` | Imagem em destaque (ex: QR Code) |
| `modal-multis` | Múltiplos valores de um mesmo campo — usuário escolhe UM e vai para uma ação externa |

### Tons do header
| Classe | Cor | Uso |
|---|---|---|
| *(nenhum)* | Cinza claro | Padrão |
| `tom-aviso` | Amarelo | Atenção, "tem certeza?" |
| `tom-erro` | Vermelho | Erro, indisponível |
| `tom-sucesso` | Verde | Confirmação positiva |

## Exemplos

**Aviso de login** (confirmação):
```html
<div class="modal-conteudo modal-sm modal-confirmar">
  <div class="modal-header"><h3>Login necessário</h3></div>
  <div class="modal-body">
    <span class="icone-destaque" aria-hidden="true">🔐</span>
    <p>Entre com sua conta Google para continuar.</p>
  </div>
  <div class="modal-footer">
    <button class="btn-modal-fechar">Agora não</button>
    <button class="btn-modal-primario">Entrar</button>
  </div>
</div>
```

**Lista de filtros**:
```html
<div class="modal-conteudo modal-lista">
  <div class="modal-header"><h3>Selecionar tipo</h3></div>
  <div class="modal-body">
    <button class="item-opcao">Subcategoria</button>
    <button class="item-opcao">Distrito</button>
    <button class="item-opcao">Delivery</button>
  </div>
  <div class="modal-footer">
    <button class="btn-modal-fechar">Fechar</button>
  </div>
</div>
```

**QR Code** (mídia):
```html
<div class="modal-conteudo modal-sm modal-midia">
  <div class="modal-header"><h3>QR Code</h3></div>
  <div class="modal-body">
    <div class="midia-wrap"><img src="…" alt="QR Code"></div>
    <p class="midia-titulo">Chaves Burguer</p>
    <div class="midia-acoes">
      <button class="btn-modal-secundario">Compartilhar</button>
      <button class="btn-modal-primario">Copiar</button>
    </div>
  </div>
</div>
```

**Erro/indisponível** (tom):
```html
<div class="modal-header tom-erro">
  <h3>Vaga indisponível</h3>
  <button class="modal-close-btn" aria-label="Fechar">×</button>
</div>
```

## Família `modal-multis`

Para quando um campo da planilha tem **vários valores** e o usuário precisa escolher **um** para acessar. Regra: só mostrar o modal se houver **2 ou mais** opções — com 1, abrir direto.

### Tipos suportados

| Modificador | Uso |
|---|---|
| `item-whatsapp` | Abrir conversa no WhatsApp |
| `item-telefone` | Ligar (tel:) |
| `item-email` | Enviar e-mail (mailto:) |
| `item-site` | Site genérico |
| `item-compra` | Link de compra / loja |
| `item-reserva` | Plataforma de reserva |
| `item-social` | Instagram, Facebook, TikTok… |

Novos tipos: basta adicionar uma linha no CSS seguindo o padrão (borda esquerda + cor do ícone).

### Exemplo — múltiplos WhatsApp

```html
<div class="modal-conteudo modal-multis">
  <div class="modal-header">
    <h3>WhatsApp — Padaria do Zé</h3>
    <button class="modal-close-btn" aria-label="Fechar">×</button>
  </div>
  <div class="modal-body">
    <a class="item-opcao item-whatsapp" href="https://wa.me/5524999999999" target="_blank" rel="noopener">
      <span class="item-icone" aria-hidden="true">💬</span>
      <span class="item-texto">
        <span class="item-label">Atendimento</span>
        <span class="item-sublabel">(24) 99999-9999</span>
      </span>
      <span class="item-seta" aria-hidden="true">→</span>
    </a>
    <a class="item-opcao item-whatsapp" href="https://wa.me/5524988888888" target="_blank" rel="noopener">
      <span class="item-icone" aria-hidden="true">💬</span>
      <span class="item-texto">
        <span class="item-label">Delivery</span>
        <span class="item-sublabel">(24) 98888-8888</span>
      </span>
      <span class="item-seta" aria-hidden="true">→</span>
    </a>
  </div>
</div>
```

### Exemplo — links de compra (livro com vários vendedores)

```html
<div class="modal-conteudo modal-multis">
  <div class="modal-header">
    <h3>Onde comprar</h3>
    <button class="modal-close-btn" aria-label="Fechar">×</button>
  </div>
  <div class="modal-body">
    <a class="item-opcao item-compra" href="https://amazon.com.br/…" target="_blank" rel="noopener">
      <span class="item-icone" aria-hidden="true">🛒</span>
      <span class="item-texto">
        <span class="item-label">Amazon</span>
        <span class="item-sublabel">amazon.com.br</span>
      </span>
      <span class="item-seta" aria-hidden="true">→</span>
    </a>
    <a class="item-opcao item-compra" href="https://shopee.com.br/…" target="_blank" rel="noopener">
      <span class="item-icone" aria-hidden="true">🛒</span>
      <span class="item-texto">
        <span class="item-label">Shopee</span>
        <span class="item-sublabel">shopee.com.br</span>
      </span>
      <span class="item-seta" aria-hidden="true">→</span>
    </a>
  </div>
</div>
```

### Exemplo — opções de reserva

```html
<a class="item-opcao item-reserva" href="https://booking.com/…" target="_blank" rel="noopener">
  <span class="item-icone" aria-hidden="true">📅</span>
  <span class="item-texto">
    <span class="item-label">Booking</span>
    <span class="item-sublabel">booking.com</span>
  </span>
  <span class="item-seta" aria-hidden="true">→</span>
</a>
```

## Acessibilidade

O CSS cobre:

- **Foco visível** reforçado (3px) em todos os controles
- **Reduced motion** — sem animação se o usuário pediu
- **Alvos de toque** mínimos de 44px em touch
- **Contraste** de todos os tons verificado contra WCAG AA

O **JS** precisa garantir (via `EconomizeiUtils.criarModalAcessivel()`):

- `role="dialog"` + `aria-modal="true"`
- Trap de foco (Tab preso dentro)
- Esc fecha
- Foco devolvido ao elemento que abriu
- Foco inicial no primeiro elemento relevante

## O que NÃO usar este CSS

- Modal de lembrete (Ônibus) — grade de botões específica
- Lightbox de imagem (Trilhas, Eventos) — visualizador, não modal
- Modal de QR criado dinamicamente (Eventos) — comportamento próprio

## Como carregar numa página

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/contatoeconomizeirioclaro-ai/economizei-assets@main/comum/tokens.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/contatoeconomizeirioclaro-ai/economizei-assets@main/comum/modais.css">
```
