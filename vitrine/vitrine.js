/* ==============================================================
   VITRINE DO ESCRITOR — JS específico da página
   Depende de: Firebase SDK (app/firestore/auth-compat), comum/firebase.js,
   comum/utils.js. Config em window.VITRINE_CONFIG
   { csvUrl, cacheKey, tallyId, paginaCategorias }
   TODO (próxima etapa): mover avaliações/login Google para comum/avaliacoes.js
   ============================================================== */
const VCFG = window.VITRINE_CONFIG || {};
const EU = EconomizeiUtils;
const { db, auth, provider } = EconomizeiFirebase;
const { sanitize, ensureHttps, gerarSlug, parseCSV } = EU;

const csvUrl = VCFG.csvUrl;
const paginaCategorias = VCFG.paginaCategorias || 'https://www.economizeirioclaro.com.br/p/categorias.html';
const cache = EU.criarCacheCSV(VCFG.cacheKey || 'vitrineEscritorCacheV2', 3600000);
const gerFav = EU.criarGerenciadorFavoritos('vitrineFavoritos');

const fallbackImage = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2Yjc5ODgiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNCAxOS41VjQuNUEyLjUgMi41IDAgMCAxIDYuNSAyaDExQTIuNSAyLjUgMCAwIDEgMjAgNC41djE1YTIuNSAyLjUgMCAwIDEtMi41IDIuNWgtMTFBMi41IDIuNSAwIDAgMSA0IDE5LjV6Ii8+PHBhdGggZD0iTTggNmg4Ii8+PHBhdGggZD0iTTggMTBoNiIvPjxwYXRoIGQ9Ik04IDE0aDQiLz48L3N2Zz4=";

let currentUser = null;
let userPhotoURL = '';
let userDisplayName = '';
let estatisticasGlobais = {};
let avaliacoesUsuarioGlobais = {};

// Ordem das colunas da planilha
const COLUNAS = {
  NOME: 0, CATEGORIA: 1, SUBCATEGORIA: 2, SINOPSE: 3, IMAGEM: 4, LINK_COMPRA: 5,
  BIO_AUTOR: 6, CONTATO: 7, ATIVO: 8, PRECO: 9, SLUG: 10, DEGUSTACAO: 11,
  NOME_LOJAS: 12, WHATSAPP: 13, REDES_SOCIAIS: 14, TELEFONES: 15
};

const TIPOS_FILTRO_VISIVEIS = {
  GENERO: { id: 'genero', nome: 'Gênero', coluna: COLUNAS.CATEGORIA },
  AUTOR: { id: 'autor', nome: 'Autor', coluna: COLUNAS.SUBCATEGORIA }
};

let dadosProcessados = [];
let todosCardsRenderizados = [];
let listaFiltradaIndices = [];
let filtrosAtivos = new Map();
let categoriaGlobal = null;
let cardsPorPagina = 20;
let paginaAtual = 1;
let vigiaScroll = null;
let livroViaQR = null;
let ctrlFiltro = null;

const $ = id => document.getElementById(id);

// ============================================================
// MODAIS (padrão comum/modais.css: classe .active + modal acessível)
// ============================================================
function abrirModal(el) {
  const c = EU.criarModalAcessivel();
  c.abrir(el);
  el.onclick = e => { if (e.target === el || e.target.closest('[data-fechar]')) c.fechar(); };
  return c;
}

// ============================================================
// UTILITÁRIOS DA PÁGINA
// ============================================================
// Separadores aceitos: ";" , quebra de linha, ou espaço antes de um novo http(s)://
function parseMultiplosLinks(valor) {
  if (!valor) return [];
  return String(valor).split(/[;\n\r]+|\s+(?=https?:\/\/)/).map(l => l.trim()).filter(Boolean).map(l => ensureHttps(l));
}
function parseListaSeparada(valor) {
  if (!valor) return [];
  return String(valor).split(/[;\n\r]+/).map(v => v.trim()).filter(Boolean);
}
// Formato igual ao grupos.js: "Nome|valor, Nome2|valor2" (separadores: vírgula, ; ou quebra de linha). "Nome|" é opcional.
function parseNomeValor(valor) {
  if (!valor) return [];
  return String(valor).split(/[,\n\r;]+/).map(s => s.trim()).filter(Boolean).map(parte => {
    const i = parte.indexOf('|');
    if (i === -1) return { nome: '', valor: parte };
    return { nome: parte.slice(0, i).trim(), valor: parte.slice(i + 1).trim() };
  }).filter(it => it.valor);
}
function getComprasItens(livro) {
  const lojasLegado = parseListaSeparada(livro[COLUNAS.NOME_LOJAS]); // compatibilidade com a coluna antiga
  return parseNomeValor(livro[COLUNAS.LINK_COMPRA]).map((it, i) => ({
    nome: it.nome || lojasLegado[i] || `Loja ${i + 1}`,
    url: ensureHttps(it.valor)
  }));
}
function normalizarTelefone(t) { return String(t || '').replace(/\D/g, ''); }
function normalizarNumeroWhatsApp(numero) {
  let n = normalizarTelefone(numero);
  if (n.startsWith('00')) n = n.slice(2);
  if (n.length === 10 || n.length === 11) n = `55${n}`;
  return n;
}
function formatarTelefone(telefone) {
  const limpo = normalizarTelefone(telefone);
  const nac = limpo.startsWith('55') && (limpo.length === 12 || limpo.length === 13) ? limpo.slice(2) : limpo;
  if (nac.length === 11) return `(${nac.slice(0, 2)}) ${nac.slice(2, 7)}-${nac.slice(7)}`;
  if (nac.length === 10) return `(${nac.slice(0, 2)}) ${nac.slice(2, 6)}-${nac.slice(6)}`;
  return String(telefone || '').trim() || 'Telefone';
}
function gerarLinkWhatsApp(numero, nomeLivro) {
  const n = normalizarNumeroWhatsApp(numero);
  if (!n) return '';
  const msg = `Olá, fiquei sabendo do seu livro "${nomeLivro}" através da Vitrine do Escritor!`;
  return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;
}
function nomeDaRedeSocial(link) {
  try {
    const url = new URL(ensureHttps(link));
    const d = url.hostname.replace(/^www\./i, '').toLowerCase();
    const partes = url.pathname.split('/').filter(Boolean);
    if (d.includes('instagram.com')) {
      const u = partes[0];
      const rotas = ['accounts', 'direct', 'explore', 'p', 'reel', 'reels', 'stories', 'tv'];
      return (u && !rotas.includes(u.toLowerCase())) ? `Instagram - @${decodeURIComponent(u)}` : 'Instagram';
    }
    if (d.includes('facebook.com')) return 'Facebook';
    if (d.includes('tiktok.com')) return 'TikTok';
    if (d.includes('youtube.com') || d.includes('youtu.be')) return 'YouTube';
    if (d.includes('linkedin.com')) return 'LinkedIn';
    if (d.includes('x.com') || d.includes('twitter.com')) return 'X (Twitter)';
    if (d.includes('threads.net')) return 'Threads';
    return 'Rede social / site';
  } catch { return 'Rede social / site'; }
}
function gerarLinkContatoLegado(valor) {
  const c = String(valor || '').trim();
  if (!c) return '';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return `mailto:${c}`;
  if (/^[\d\s()+-]+$/.test(c)) { const n = normalizarTelefone(c); return n ? `tel:${n}` : ''; }
  return ensureHttps(c);
}

// ============================================================
// QR CODE (contrato do app: window.abrirQRCode(event, nome, qrCodeURL, urlQRCode))
// ============================================================
function gerarURLQRCode(nome) {
  return EU.gerarURLQRCode(location.origin + location.pathname, gerarSlug(nome));
}
function gerarImagemQRCode(nome, tamanho = 200) {
  return EU.gerarImagemQRCode(gerarURLQRCode(nome), tamanho);
}

function abrirQRCode(event, nome, qrCodeURL, urlQRCode) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'QR Code de ' + nome);
  modal.innerHTML =
    '<div class="modal-conteudo modal-sm modal-midia">' +
      '<div class="modal-header">' +
        '<h3><i class="fa-solid fa-qrcode" aria-hidden="true"></i> QR Code</h3>' +
        '<button class="modal-close-btn" data-fechar-qr aria-label="Fechar QR Code">×</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="midia-wrap"><img src="' + sanitize(qrCodeURL) + '" alt="QR Code para ' + sanitize(nome) + '" decoding="async" width="220" height="220"></div>' +
        '<p class="midia-titulo">' + sanitize(nome) + '</p>' +
        '<div class="midia-acoes">' +
          '<button class="btn-modal-secundario" data-acao="compartilhar"><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> Compartilhar</button>' +
          '<button class="btn-modal-primario" data-acao="copiar"><i class="fa-solid fa-copy" aria-hidden="true"></i> Copiar</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  const ctrl = EU.criarModalAcessivel();
  ctrl.abrir(modal, () => modal.remove());
  modal.addEventListener('click', e => {
    const t = e.target;
    if (t === modal || t.closest('[data-fechar-qr]')) { ctrl.fechar(); return; }
    const btn = t.closest('[data-acao]');
    if (!btn) return;
    if (btn.dataset.acao === 'compartilhar') {
      if (navigator.share) navigator.share({ title: nome, url: urlQRCode });
      else EU.mostrarToast('Compartilhamento não suportado');
    } else {
      navigator.clipboard.writeText(urlQRCode).then(() => EU.mostrarToast('URL copiada!'));
    }
  });
}

// ============================================================
// MODAIS DE MÚLTIPLAS OPÇÕES (comum/utils.js → abrirModalMulti)
// ============================================================
function abrirLinksCompra(event, index) {
  event.stopPropagation();
  const livro = dadosProcessados[index];
  const nomeLivro = livro[COLUNAS.NOME] || '';
  const itens = getComprasItens(livro).map(it => ({
    nome: it.nome, url: it.url, classe: 'item-compra', icone: 'fa-solid fa-cart-shopping'
  }));
  const whats = parseNomeValor(livro[COLUNAS.WHATSAPP])[0];
  if (whats) {
    itens.push({
      nome: 'Comprar direto com o autor', sublabel: 'WhatsApp',
      url: gerarLinkWhatsApp(whats.valor, nomeLivro), classe: 'item-whatsapp', icone: 'fa-brands fa-whatsapp'
    });
  }
  EU.abrirModalMulti('Onde comprar', itens, 'fa-solid fa-cart-shopping');
}

function abrirLinksContato(event, index) {
  event.stopPropagation();
  const livro = dadosProcessados[index];
  const nomeLivro = livro[COLUNAS.NOME] || '';
  const itens = [];

  parseNomeValor(livro[COLUNAS.WHATSAPP]).forEach(it => {
    const url = gerarLinkWhatsApp(it.valor, nomeLivro);
    if (url) itens.push({ nome: it.nome || 'WhatsApp', sublabel: formatarTelefone(it.valor), url, classe: 'item-whatsapp', icone: 'fa-brands fa-whatsapp' });
  });
  parseNomeValor(livro[COLUNAS.TELEFONES]).forEach(it => {
    const limpo = normalizarTelefone(it.valor);
    if (limpo) itens.push({ nome: it.nome || 'Ligar', sublabel: formatarTelefone(it.valor), url: `tel:${limpo}`, classe: 'item-telefone', icone: 'fa-solid fa-phone' });
  });
  parseNomeValor(livro[COLUNAS.REDES_SOCIAIS]).forEach(it => {
    const url = ensureHttps(it.valor);
    itens.push({ nome: it.nome || nomeDaRedeSocial(url), url, classe: 'item-social', icone: 'fa-solid fa-share-nodes' });
  });
  parseListaSeparada(livro[COLUNAS.CONTATO]).forEach(c => {
    const url = gerarLinkContatoLegado(c);
    if (!url) return;
    if (url.startsWith('mailto:')) itens.push({ nome: 'E-mail', sublabel: c, url, classe: 'item-email', icone: 'fa-solid fa-envelope' });
    else if (url.startsWith('tel:')) itens.push({ nome: 'Ligar', sublabel: formatarTelefone(c), url, classe: 'item-telefone', icone: 'fa-solid fa-phone' });
    else itens.push({ nome: 'Outro contato', url, classe: 'item-site', icone: 'fa-solid fa-link' });
  });
  EU.abrirModalMulti('Como entrar em contato', itens, 'fa-solid fa-address-book');
}

// ============================================================
// FIREBASE — AVALIAÇÕES (será movido para comum/avaliacoes.js)
// ============================================================
async function getEstatisticasAvaliacoes() {
  try {
    const snap = await db.collection('avaliacoes').get();
    const stats = {};
    snap.forEach(doc => {
      const d = doc.data();
      if (!stats[d.estabelecimentoId]) stats[d.estabelecimentoId] = { soma: 0, total: 0 };
      stats[d.estabelecimentoId].soma += d.pontuacao;
      stats[d.estabelecimentoId].total += 1;
    });
    const r = {};
    for (const [id, v] of Object.entries(stats)) r[id] = { media: v.soma / v.total, total: v.total };
    return r;
  } catch (e) { console.error('Erro ao buscar estatísticas:', e); return {}; }
}
async function getAvaliacoesUsuario() {
  if (!currentUser) return {};
  try {
    const snap = await db.collection('avaliacoes').where('userId', '==', currentUser.uid).get();
    const map = {};
    snap.forEach(doc => { map[doc.data().estabelecimentoId] = doc.data().pontuacao; });
    return map;
  } catch (e) { console.error('Erro ao buscar avaliações do usuário:', e); return {}; }
}
async function salvarAvaliacaoFirebase(id, pontuacao) {
  if (!currentUser) return;
  try {
    await db.collection('avaliacoes').doc(`${currentUser.uid}_${id}`).set({
      userId: currentUser.uid, estabelecimentoId: id, pontuacao,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) { console.error('Erro ao salvar avaliação:', e); }
}
function definirUsuario(user) {
  currentUser = user;
  userPhotoURL = user?.photoURL || '';
  userDisplayName = user ? (user.displayName || user.email?.split('@')[0] || 'Usuário') : '';
}

// Contratos do app Android (nomes fixos)
window.onLoginSuccess = function (idToken) {
  const pending = JSON.parse(sessionStorage.getItem('pendingRating') || 'null');
  const credential = firebase.auth.GoogleAuthProvider.credential(idToken);
  auth.signInWithCredential(credential).then(result => {
    definirUsuario(result.user);
    const seguir = () => { sessionStorage.removeItem('pendingRating'); salvarPosicaoEAntesRecarregar(); };
    if (pending && pending.nome && pending.rating) salvarAvaliacaoFirebase(pending.nome, pending.rating).then(seguir);
    else seguir();
  }).catch(e => { console.error('Erro ao autenticar com token:', e); alert('Erro ao fazer login. Tente novamente.'); });
};
window.onLoginError = function (msg) { alert('Erro no login: ' + msg); };

function salvarPosicaoEAntesRecarregar() {
  sessionStorage.setItem('scrollPos', window.scrollY);
  const aberto = document.querySelector('.card-expanded-container.active');
  if (aberto) sessionStorage.setItem('expandedIndex', aberto.dataset.index);
  else sessionStorage.removeItem('expandedIndex');
  location.reload();
}
function restaurarPosicao() {
  const scrollPos = sessionStorage.getItem('scrollPos');
  const expandedIndex = sessionStorage.getItem('expandedIndex');
  if (scrollPos) { window.scrollTo(0, parseInt(scrollPos)); sessionStorage.removeItem('scrollPos'); }
  if (expandedIndex !== null) {
    setTimeout(() => {
      const ex = document.querySelector(`.card-expanded-container[data-index="${expandedIndex}"]`);
      const card = ex?.previousElementSibling;
      if (card && ex) {
        const t = card.querySelector('.card-toggle');
        if (t) t.textContent = 'Ocultar detalhes';
        ex.classList.add('active');
      }
      sessionStorage.removeItem('expandedIndex');
    }, 100);
  }
}

// Modal de aviso de login (modal-confirmar) + login Google (nativo no app ou popup)
function pedirLoginGoogle(aoLogar) {
  if (window.Android && typeof window.Android.iniciarLoginGoogle === 'function') return false;
  const modal = $('modalAvisoLogin');
  const ctrl = abrirModal(modal);
  $('btnCancelarAviso').onclick = () => ctrl.fechar();
  $('btnContinuarGoogle').onclick = () => {
    ctrl.fechar();
    auth.signInWithPopup(provider).then(r => { definirUsuario(r.user); return aoLogar(); })
      .catch(e => {
        console.error('Erro no login:', e);
        if (e.code === 'auth/popup-blocked') alert('O pop-up foi bloqueado. Permita pop-ups para este site ou tente novamente.');
        else if (e.code !== 'auth/popup-closed-by-user') alert('Erro ao fazer login: ' + e.message);
      });
  };
  return true;
}

// ============================================================
// CARREGAR DADOS
// ============================================================
async function carregarDados() {
  const loading = $('loading'), lista = $('lista');
  loading.style.display = 'flex';
  lista.style.display = 'none';

  let linhas = cache.ler();
  if (!linhas) {
    try {
      const resp = await fetch(csvUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      linhas = parseCSV(await resp.text());
      cache.salvar(linhas);
    } catch (e) {
      console.error('Erro ao buscar a planilha:', e);
      loading.innerHTML = `<span style="color:#dc3545;">❌ Erro ao carregar os dados. Verifique sua conexão.</span><br><small>${sanitize(e.message)}</small>`;
      return;
    }
  }
  if (linhas.length < 2) {
    loading.innerHTML = '<span style="color:#dc3545;">❌ A planilha está vazia ou com formato incorreto.</span>';
    return;
  }

  dadosProcessados = linhas.slice(1).filter(c => c[COLUNAS.ATIVO] && c[COLUNAS.ATIVO].toLowerCase() === 'sim');
  if (!dadosProcessados.length) {
    loading.innerHTML = '<span style="color:#b45309;">⚠️ Nenhum livro ativo encontrado. Verifique a coluna "Ativo".</span>';
    return;
  }

  loading.style.display = 'none';
  lista.style.display = window.innerWidth <= 768 ? 'flex' : 'grid';

  await carregarEstatisticas();
  renderizarCards();
  aplicarFiltroURL();
  aplicarFiltrosEOrdenacao();
  atualizarFichasFiltros();
  processarQR();
  restaurarPosicao();
}

function processarQR() {
  const params = new URLSearchParams(location.search);
  if (!params.has('qr')) return;
  const slugQR = params.get('qr').toLowerCase().trim().replace(/-+$/, '');
  const livro = dadosProcessados.find(est => {
    const s = est[COLUNAS.SLUG] ? est[COLUNAS.SLUG].toLowerCase().trim().replace(/-+$/, '') : '';
    return (s && s === slugQR) || gerarSlug(est[COLUNAS.NOME]).replace(/-+$/, '') === slugQR;
  });
  if (!livro) return;
  livroViaQR = livro;
  const nome = livro[COLUNAS.NOME];
  $('busca').value = nome;
  criarIndicadorQRCodeLivro(nome);
  const index = dadosProcessados.indexOf(livro);
  listaFiltradaIndices = [index];
  paginaAtual = 1;
  renderizarPagina();
  setTimeout(() => {
    const item = todosCardsRenderizados[index];
    if (item) { toggleCardExpandido(item.card); item.card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }, 300);
}

async function carregarEstatisticas() {
  const [est, av] = await Promise.all([getEstatisticasAvaliacoes(), currentUser ? getAvaliacoesUsuario() : {}]);
  estatisticasGlobais = est;
  avaliacoesUsuarioGlobais = av;
}

// ============================================================
// RENDERIZAR CARDS
// ============================================================
const GENEROS_CLASSE = [
  ['fantasia', 'genero-fantasia'], ['suspense', 'genero-suspense'], ['poesia', 'genero-poesia'],
  ['autoajuda', 'genero-autoajuda'], ['romance', 'genero-romance'],
  ['ficção científica', 'genero-ficcao-cientifica'], ['ficcao cientifica', 'genero-ficcao-cientifica'],
  ['terror', 'genero-terror'], ['biografia', 'genero-biografia'],
  ['infantojuvenil', 'genero-infantojuvenil'], ['infantil', 'genero-infantojuvenil']
];
function classeGenero(categoria) {
  const g = categoria.toLowerCase();
  const achado = GENEROS_CLASSE.find(([k]) => g.includes(k));
  return achado ? achado[1] : 'genero-outro';
}

function renderizarCards() {
  todosCardsRenderizados = [];
  dadosProcessados.forEach((c, index) => {
    const nome = c[COLUNAS.NOME] || '';
    const categoria = c[COLUNAS.CATEGORIA] || '';
    const autor = c[COLUNAS.SUBCATEGORIA] || '';
    const sinopse = c[COLUNAS.SINOPSE] || '';
    const imagem = ensureHttps(c[COLUNAS.IMAGEM]) || fallbackImage;
    const compras = getComprasItens(c);
    const bioAutor = c[COLUNAS.BIO_AUTOR] || '';
    const preco = c[COLUNAS.PRECO] || 'Preço sob consulta';
    const degustacao = c[COLUNAS.DEGUSTACAO] ? ensureHttps(c[COLUNAS.DEGUSTACAO].trim()) : '';
    const isFavorito = gerFav.tem(nome);

    const whatsapps = parseNomeValor(c[COLUNAS.WHATSAPP]);
    const whatsapp = whatsapps[0]?.valor || '';
    const linkWhats = whatsapp ? gerarLinkWhatsApp(whatsapp, nome) : '';
    const totalCompra = compras.length + (whatsapp ? 1 : 0);
    const totalContato = whatsapps.length + parseNomeValor(c[COLUNAS.TELEFONES]).length +
      parseNomeValor(c[COLUNAS.REDES_SOCIAIS]).length + parseListaSeparada(c[COLUNAS.CONTATO]).length;

    const stats = estatisticasGlobais[nome] || { media: 0, total: 0 };
    const mediaFmt = stats.media > 0 ? stats.media.toFixed(1) : '0.0';
    const estrelasHTML = Array.from({ length: 5 }, (_, i) => i < Math.round(stats.media) ? '★' : '☆').join('');
    const userRating = avaliacoesUsuarioGlobais[nome] || 0;

    const card = document.createElement('div');
    card.className = 'card' + (isFavorito ? ' card-favorito' : '');
    card.dataset.nome = nome;
    card.dataset.categoria = categoria;
    card.dataset.autor = autor;
    card.dataset.index = index;

    card.innerHTML = `
      <div class="card-img-container">
        <img class="card-img" src="${sanitize(imagem)}" alt="${sanitize(nome)}" loading="${index < 4 ? 'eager' : 'lazy'}" decoding="async" />
        <div class="fallback-icon"><svg viewBox="0 0 24 24"><path d="M4 19.5V4.5A2.5 2.5 0 0 1 6.5 2h11A2.5 2.5 0 0 1 20 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 19.5z"/><path d="M8 6h8"/><path d="M8 10h6"/><path d="M8 14h4"/></svg></div>
      </div>
      <div class="card-status ${classeGenero(categoria)}">📖 ${sanitize(categoria)}</div>
      <button class="btn-favorito ${isFavorito ? 'ativo' : ''}" data-index="${index}" aria-label="Favoritar">${isFavorito ? '♥' : '♡'}</button>
      <div class="card-content">
        <h3 class="card-title">${sanitize(nome)}</h3>
        <div class="card-categoria-container"><div class="card-subcategoria">por ${sanitize(autor)}</div></div>
        <div class="card-preco">${sanitize(preco)}</div>
        <div class="card-avaliacao-header">
          <div class="estrelas-header">${estrelasHTML}</div>
          <div class="nota-header">${mediaFmt} (${stats.total} ${stats.total === 1 ? 'voto' : 'votos'})</div>
        </div>
        <button class="card-toggle" data-index="${index}">Ver detalhes</button>
      </div>`;

    const ex = document.createElement('div');
    ex.className = 'card-expanded-container';
    ex.dataset.index = index;

    const estrelasUsuario = Array.from({ length: 5 }, (_, i) =>
      `<button class="estrela-btn ${i < userRating ? 'ativa' : ''}" data-rating="${i + 1}" data-index="${index}" aria-label="${i + 1} estrela${i ? 's' : ''}">★</button>`
    ).join('');

    const authHTML = currentUser
      ? `<div style="display:flex;align-items:center;margin-left:auto;">
           ${userPhotoURL ? `<img src="${sanitize(userPhotoURL)}" class="foto-perfil" alt="foto" loading="lazy" decoding="async" width="26" height="26">` : ''}
           <span style="margin:0 4px;">olá ${sanitize(userDisplayName.split(' ')[0])}</span>
           <span class="link-sair">Sair</span></div>`
      : `<span class="link-entrar" style="margin-left:auto;">Entrar</span>`;

    let botaoComprar = '';
    if (totalCompra > 1) botaoComprar = `<button class="btn-acao btn-comprar" onclick="abrirLinksCompra(event, ${index})"><i class="fa-solid fa-cart-shopping" aria-hidden="true"></i> Comprar</button>`;
    else if (totalCompra === 1) botaoComprar = `<a href="${sanitize(compras[0]?.url || linkWhats)}" target="_blank" rel="noopener noreferrer" class="btn-acao btn-comprar"><i class="fa-solid fa-cart-shopping" aria-hidden="true"></i> Comprar</a>`;

    ex.innerHTML = `
      <div class="card-expanded">
        <div class="detalhes-grid">
          <div class="detalhe-item"><strong>📖 Sinopse</strong> ${sanitize(sinopse)}</div>
          <div class="detalhe-item"><strong>✍️ Autor</strong> ${sanitize(autor)}</div>
          <div class="detalhe-item"><strong>💰 Preço</strong> ${sanitize(preco)}</div>
          <div class="detalhe-item" style="grid-column:1/-1;"><strong>👤 Biografia</strong> ${sanitize(bioAutor)}</div>
        </div>
        <div class="avaliacao-section">
          <div class="avaliacao-conteudo">
            <div class="avaliacao-texto-instrucao">
              <div class="avaliacao-titulo">
                <span>⭐ Avalie este livro</span><span class="avaliacao-separador">•</span>
                <span class="avaliacao-instrucao">Clique nas estrelas para avaliar</span>
              </div>
            </div>
            ${authHTML}
          </div>
          <div class="avaliacao-estrelas" data-index="${index}">${estrelasUsuario}</div>
          <div class="avaliacao-resultado">${userRating ? `Sua nota: ${userRating} estrela${userRating > 1 ? 's' : ''}` : ''}</div>
        </div>
        <div class="card-acoes">
          ${botaoComprar}
          ${degustacao ? `<a href="${sanitize(degustacao)}" target="_blank" rel="noopener noreferrer" class="btn-acao btn-degustacao"><i class="fa-solid fa-book-open" aria-hidden="true"></i> Degustação</a>` : ''}
          ${totalContato > 0 ? `<button type="button" class="btn-acao btn-contato" onclick="abrirLinksContato(event, ${index})"><i class="fa-solid fa-address-book" aria-hidden="true"></i> Contato</button>` : ''}
          <button type="button" class="btn-acao btn-compartilhar"><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> Compartilhar</button>
        </div>
      </div>`;

    const qrImg = gerarImagemQRCode(nome), qrUrl = gerarURLQRCode(nome);
    ex.querySelector('.btn-compartilhar').addEventListener('click', ev => { ev.stopPropagation(); window.abrirQRCode(ev, nome, qrImg, qrUrl); });

    todosCardsRenderizados.push({ card, expanded: ex, index });
  });
  $('lista').style.display = window.innerWidth <= 768 ? 'flex' : 'grid';
  aplicarOtimizacoesImagem();
}

function aplicarOtimizacoesImagem() {
  document.querySelectorAll('.card-img').forEach(img => {
    if (img.dataset.bound) return;
    img.dataset.bound = '1';
    if (img.complete && img.naturalWidth) img.classList.add('loaded');
    img.addEventListener('load', () => img.classList.add('loaded'));
    img.addEventListener('error', () => {
      img.classList.add('error');
      if (img.src !== fallbackImage) img.src = fallbackImage;
    });
  });
}

// ============================================================
// INTERAÇÕES
// ============================================================
function handleEstrelaClick(e) {
  e.stopPropagation();
  const rating = parseInt(this.dataset.rating);
  const nome = dadosProcessados[this.dataset.index][COLUNAS.NOME];

  if (!currentUser) {
    if (window.Android && typeof window.Android.iniciarLoginGoogle === 'function') {
      sessionStorage.setItem('pendingRating', JSON.stringify({ rating, nome }));
      window.Android.iniciarLoginGoogle(rating.toString(), 0, nome);
      return;
    }
    pedirLoginGoogle(() => salvarAvaliacaoFirebase(nome, rating).then(salvarPosicaoEAntesRecarregar));
    return;
  }
  const container = this.closest('.avaliacao-estrelas');
  container.querySelectorAll('.estrela-btn').forEach((s, i) => s.classList.toggle('ativa', i < rating));
  const res = container.parentElement.querySelector('.avaliacao-resultado');
  if (res) res.textContent = `Sua nota: ${rating} estrela${rating > 1 ? 's' : ''}`;
  salvarAvaliacaoFirebase(nome, rating).then(salvarPosicaoEAntesRecarregar);
}

function toggleCardExpandido(card) {
  if (!card) return;
  const ex = card.nextElementSibling;
  if (!ex?.classList.contains('card-expanded-container')) return;
  const btn = card.querySelector('.card-toggle');
  if (ex.classList.contains('active')) {
    ex.classList.remove('active');
    if (btn) btn.textContent = 'Ver detalhes';
    return;
  }
  document.querySelectorAll('.card-expanded-container.active').forEach(c => {
    c.classList.remove('active');
    const b = c.previousElementSibling?.querySelector('.card-toggle');
    if (b) b.textContent = 'Ver detalhes';
  });
  ex.classList.add('active');
  if (btn) btn.textContent = 'Ocultar detalhes';
  setTimeout(() => ex.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
}

function handleCardClick(e) {
  if (e.target.closest('.btn-favorito, .card-toggle')) return;
  toggleCardExpandido(this);
}
function handleToggleClick(e) { e.stopPropagation(); toggleCardExpandido(this.closest('.card')); }
function handleFavoritoClick(e) {
  e.stopPropagation();
  const card = this.closest('.card');
  const fav = gerFav.toggle(card.dataset.nome);
  this.classList.toggle('ativo', fav);
  this.innerHTML = fav ? '♥' : '♡';
  card.classList.toggle('card-favorito', fav);
  aplicarFiltrosEOrdenacao();
}
function handleLinkEntrarClick(e) {
  e.stopPropagation();
  if (window.Android && typeof window.Android.iniciarLoginGoogle === 'function') {
    sessionStorage.setItem('pendingRating', JSON.stringify({ rating: null, nome: null }));
    window.Android.iniciarLoginGoogle('', 0, '');
    return;
  }
  pedirLoginGoogle(salvarPosicaoEAntesRecarregar);
}
function handleLinkSairClick(e) {
  e.stopPropagation();
  auth.signOut().then(() => { definirUsuario(null); salvarPosicaoEAntesRecarregar(); })
    .catch(err => console.error('Erro ao sair:', err));
}

function ativarInteracoesCards() {
  const liga = (sel, ev, fn) => document.querySelectorAll(sel).forEach(el => { el.removeEventListener(ev, fn); el.addEventListener(ev, fn); });
  liga('.card', 'click', handleCardClick);
  liga('.card-toggle', 'click', handleToggleClick);
  liga('.btn-favorito', 'click', handleFavoritoClick);
  liga('.estrela-btn', 'click', handleEstrelaClick);
  liga('.link-entrar', 'click', handleLinkEntrarClick);
  liga('.link-sair', 'click', handleLinkSairClick);
  aplicarOtimizacoesImagem();
}

// ============================================================
// FILTROS E PAGINAÇÃO
// ============================================================
function aplicarFiltrosEOrdenacao() {
  if (!dadosProcessados.length || !todosCardsRenderizados.length) return;
  let indices = [];
  const busca = $('busca').value.toLowerCase().trim();

  if (livroViaQR) {
    const nomeQR = livroViaQR[COLUNAS.NOME];
    indices = dadosProcessados.map((e, i) => e[COLUNAS.NOME] === nomeQR ? i : null).filter(i => i !== null);
  } else {
    dadosProcessados.forEach((est, idx) => {
      if (busca) {
        const campos = [est[COLUNAS.NOME], est[COLUNAS.SUBCATEGORIA], est[COLUNAS.CATEGORIA]].map(v => (v || '').toLowerCase());
        if (!campos.some(v => v.includes(busca))) return;
      }
      if (categoriaGlobal && est[COLUNAS.CATEGORIA] !== categoriaGlobal) return;
      for (const [tipo, valor] of filtrosAtivos) {
        const info = Object.values(TIPOS_FILTRO_VISIVEIS).find(t => t.id === tipo);
        if (info && (est[info.coluna] || '') !== valor) return;
      }
      indices.push(idx);
    });
    const favs = gerFav.getTodos();
    indices.sort((a, b) => {
      const fa = favs.includes(dadosProcessados[a][COLUNAS.NOME]), fb = favs.includes(dadosProcessados[b][COLUNAS.NOME]);
      return fa === fb ? 0 : fa ? -1 : 1;
    });
  }
  listaFiltradaIndices = indices;
  paginaAtual = 1;
  if (vigiaScroll) { vigiaScroll.disconnect(); vigiaScroll = null; }
  renderizarPagina();
}

function renderizarPagina() {
  const lista = $('lista');
  lista.innerHTML = '';
  const fim = paginaAtual * cardsPorPagina;
  listaFiltradaIndices.slice(0, fim).forEach(idx => {
    const item = todosCardsRenderizados[idx];
    if (item) { lista.appendChild(item.card); lista.appendChild(item.expanded); }
  });
  ativarInteracoesCards();
  if (fim < listaFiltradaIndices.length) colocarEspiao();
  else if (vigiaScroll) vigiaScroll.disconnect();
  if (!listaFiltradaIndices.length) {
    lista.innerHTML = `<div class="sem-resultados"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><h3>Nenhum livro encontrado</h3><p>Tente alterar os filtros de busca.</p><button onclick="limparTodosFiltros()" class="btn-voltar-categorias"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Limpar Filtros</button></div>`;
  }
}

function colocarEspiao() {
  if (vigiaScroll) vigiaScroll.disconnect();
  const esp = document.createElement('div');
  esp.id = 'espiao'; esp.style.cssText = 'height:10px;width:100%';
  $('lista').appendChild(esp);
  vigiaScroll = new IntersectionObserver(en => { if (en[0].isIntersecting) { paginaAtual++; renderizarPagina(); } });
  vigiaScroll.observe(esp);
}

// ============================================================
// UI DE FILTROS
// ============================================================
function atualizarFichasFiltros() {
  const lista = $('filtrosAtivosLista');
  lista.innerHTML = '';
  filtrosAtivos.forEach((valor, tipo) => {
    const info = Object.values(TIPOS_FILTRO_VISIVEIS).find(t => t.id === tipo);
    if (!info) return;
    const f = document.createElement('div');
    f.className = 'ficha-filtro';
    f.innerHTML = `<span class="ficha-filtro-tipo">${sanitize(info.nome)}</span>: <span>${sanitize(valor)}</span><button class="ficha-filtro-remover" aria-label="Remover filtro">×</button>`;
    f.querySelector('button').addEventListener('click', e => { e.stopPropagation(); removerFiltro(tipo); });
    f.addEventListener('click', () => abrirModalOpcoesFiltro(tipo));
    lista.appendChild(f);
  });
}

function adicionarFiltro(tipo, valor) {
  if (tipo === 'categoria') { categoriaGlobal = valor; criarIndicadorCategoria(valor); }
  else filtrosAtivos.set(tipo, valor);
  atualizarFichasFiltros();
  aplicarFiltrosEOrdenacao();
}
function removerFiltro(tipo) {
  filtrosAtivos.delete(tipo);
  atualizarFichasFiltros();
  aplicarFiltrosEOrdenacao();
}
function limparUrlQR() {
  const url = new URL(location);
  url.searchParams.delete('qr');
  history.replaceState({}, '', url);
}
function limparTodosFiltros() {
  filtrosAtivos.clear();
  categoriaGlobal = null;
  livroViaQR = null;
  $('indicadorCategoriaContainer').innerHTML = '';
  $('indicadorQRCodeContainer').innerHTML = '';
  $('busca').value = '';
  limparUrlQR();
  atualizarFichasFiltros();
  aplicarFiltrosEOrdenacao();
}

function criarIndicadorCategoria(categoria) {
  $('indicadorCategoriaContainer').innerHTML =
    `<div class="indicador-categoria-selecionada"><div class="categoria-info"><div class="categoria-icone">📋</div><div class="categoria-texto"><div class="categoria-titulo">Você está explorando</div><div class="categoria-nome">${sanitize(categoria)}</div></div></div><a href="${sanitize(paginaCategorias)}" class="botao-voltar-categorias">← Voltar para página de categorias</a></div>`;
}
function criarIndicadorQRCodeLivro(nome) {
  $('indicadorQRCodeContainer').innerHTML = `
    <div class="indicador-qr-code">
      <div class="qr-info"><div class="qr-icone">📱</div>
        <div class="qr-texto"><div class="qr-titulo">Você escaneou um QR Code</div><div class="qr-nome">${sanitize(nome)}</div></div></div>
      <button class="botao-fechar-qr" onclick="fecharQRCodeLivro()">← Ver todos os livros</button>
    </div>`;
}
function fecharQRCodeLivro() {
  livroViaQR = null;
  $('indicadorQRCodeContainer').innerHTML = '';
  $('busca').value = '';
  limparUrlQR();
  aplicarFiltrosEOrdenacao();
}

// Modais de filtro (modal-lista: × no header, sem footer)
function abrirModalTiposFiltro() {
  const lista = $('listaTiposFiltro');
  lista.innerHTML = '';
  Object.values(TIPOS_FILTRO_VISIVEIS).forEach(tipo => {
    const b = document.createElement('button');
    b.className = 'item-opcao';
    b.textContent = tipo.nome;
    b.addEventListener('click', () => abrirModalOpcoesFiltro(tipo.id));
    lista.appendChild(b);
  });
  if (ctrlFiltro) ctrlFiltro.fechar();
  ctrlFiltro = abrirModal($('modalAdicionarFiltro'));
}

function abrirModalOpcoesFiltro(tipoId) {
  const info = Object.values(TIPOS_FILTRO_VISIVEIS).find(t => t.id === tipoId);
  if (!info) return;
  $('tituloOpcoesFiltro').textContent = `Selecionar ${info.nome}`;
  const lista = $('listaOpcoesFiltro');
  lista.innerHTML = '';
  const atual = filtrosAtivos.get(tipoId);
  const opcoes = [...new Set(dadosProcessados.map(i => i[info.coluna]).filter(Boolean))].sort();

  const add = (rotulo, onClick, sel) => {
    const b = document.createElement('button');
    b.className = 'item-opcao' + (sel ? ' selecionada' : '');
    b.textContent = rotulo;
    b.addEventListener('click', () => { if (ctrlFiltro) ctrlFiltro.fechar(); onClick(); });
    lista.appendChild(b);
  };
  add('Todos', () => removerFiltro(tipoId), !atual);
  opcoes.forEach(op => add(op, () => adicionarFiltro(tipoId, op), op === atual));

  if (ctrlFiltro) ctrlFiltro.fechar();
  ctrlFiltro = abrirModal($('modalOpcoesFiltro'));
}

// ?cat=slug
function aplicarFiltroURL() {
  const params = new URLSearchParams(location.search);
  if (!params.has('cat')) return;
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const slug = norm(params.get('cat').trim());
  const cat = dadosProcessados.map(c => c[COLUNAS.CATEGORIA]).find(c => c && norm(c) === slug);
  if (cat) adicionarFiltro('categoria', cat);
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================
function iniciarVitrine() {
  $('btnCadastrarLivro').addEventListener('click', () => {
    if (window.Tally) Tally.openPopup(VCFG.tallyId || 'RG2MO4', { layout: 'modal', width: 850, autoClose: 5000 });
  });
  $('btnAdicionarFiltro').addEventListener('click', abrirModalTiposFiltro);
  $('btnLimparFiltros').addEventListener('click', limparTodosFiltros);
  $('busca').addEventListener('input', aplicarFiltrosEOrdenacao);

  auth.onAuthStateChanged(user => {
    definirUsuario(user);
    if (user) {
      carregarEstatisticas().then(() => {
        if (dadosProcessados.length) { renderizarCards(); aplicarFiltrosEOrdenacao(); }
      });
    }
  });
  carregarDados();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciarVitrine);
else iniciarVitrine();

// Contrato do app Android: o app sequestra window.abrirQRCode (AndroidQR) e abre a QrCodeActivity nativa.
// Assinatura fixa: (event, nome, qrCodeURL=imagem, urlQRCode=link). Manter por último, como no grupos.js.
window.abrirQRCode = abrirQRCode;
