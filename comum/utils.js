/* ==============================================================
   ECONOMIZEI! RIO CLARO — UTILITÁRIOS COMPARTILHADOS
   Usado por: grupos, vitrine, trilhas, ônibus, eventos, vagas.
   Sem dependências externas. Expõe tudo em window.EconomizeiUtils.
   ============================================================== */
(function (global) {
    'use strict';

    // ---------- SANITIZAÇÃO ----------
    function sanitize(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function ensureHttps(url) {
        if (!url) return '';
        return url.startsWith('http') ? url : 'https://' + url;
    }

    function linkSeguro(url, base) {
        if (!url) return '#';
        try {
            const u = new URL(url, base || global.location.href);
            if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
        } catch (e) { /* URL inválida */ }
        return '#';
    }

    function gerarSlug(texto) {
        if (!texto) return '';
        return texto.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    }

    // ---------- PARSER CSV ----------
    function parseCSV(texto) {
        const linhas = [];
        let dentroAspas = false, campo = '', linha = [];
        for (let i = 0; i < texto.length; i++) {
            const c = texto[i], p = texto[i + 1];
            if (c === '"') {
                if (!dentroAspas) dentroAspas = true;
                else if (p === '"') { campo += '"'; i++; }
                else dentroAspas = false;
            } else if (c === ',' && !dentroAspas) {
                linha.push(campo); campo = '';
            } else if ((c === '\n' || c === '\r') && !dentroAspas) {
                if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
                campo = ''; linha = [];
                if (c === '\r' && p === '\n') i++;
            } else {
                campo += c;
            }
        }
        if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
        return linhas;
    }

    // ---------- CACHE DE CSV ----------
    function criarCacheCSV(chave, duracaoMs) {
        return {
            ler() {
                try {
                    const cache = localStorage.getItem(chave);
                    const ts = localStorage.getItem(chave + '_timestamp');
                    if (!cache || !ts) return null;
                    if (Date.now() - ts >= duracaoMs) return null;
                    return JSON.parse(cache);
                } catch (erro) {
                    console.warn('Cache "' + chave + '" corrompido, ignorando.', erro);
                    try {
                        localStorage.removeItem(chave);
                        localStorage.removeItem(chave + '_timestamp');
                    } catch (e) { /* ignora */ }
                    return null;
                }
            },
            salvar(linhas) {
                try {
                    localStorage.setItem(chave, JSON.stringify(linhas));
                    localStorage.setItem(chave + '_timestamp', Date.now().toString());
                    return true;
                } catch (erro) {
                    console.warn('Não foi possível salvar o cache "' + chave + '".', erro);
                    return false;
                }
            }
        };
    }

    // ---------- FAVORITOS ----------
    function criarGerenciadorFavoritos(chave) {
        function getTodos() {
            try { return JSON.parse(localStorage.getItem(chave)) || []; }
            catch (e) { return []; }
        }
        function salvar(lista) {
            try { localStorage.setItem(chave, JSON.stringify(lista)); }
            catch (e) { console.warn('Não foi possível salvar favoritos "' + chave + '".', e); }
        }
        return {
            getTodos,
            tem(id) { return getTodos().includes(id); },
            toggle(id) {
                const lista = getTodos();
                const idx = lista.indexOf(id);
                if (idx > -1) lista.splice(idx, 1); else lista.push(id);
                salvar(lista);
                return lista.includes(id);
            }
        };
    }

    // ---------- QR CODE ----------
    function gerarURLQRCode(baseUrl, slugOuParam) {
        return baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'qr=' + encodeURIComponent(slugOuParam);
    }
    function gerarImagemQRCode(urlAlvo, tamanho) {
        tamanho = tamanho || 200;
        return 'https://api.qrserver.com/v1/create-qr-code/?size=' + tamanho + 'x' + tamanho +
            '&data=' + encodeURIComponent(urlAlvo);
    }

    // ---------- MODAL ACESSÍVEL ----------
    function criarModalAcessivel() {
        let elementoFocoAnterior = null;
        let modalAtivoEl = null;
        let onFechar = null;

        function obterFocaveis(modalEl) {
            return Array.from(modalEl.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )).filter(el => !el.disabled && el.offsetParent !== null);
        }

        function trapFocusHandler(e) {
            if (!modalAtivoEl) return;
            if (e.key === 'Escape') { e.preventDefault(); fechar(); return; }
            if (e.key !== 'Tab') return;
            const focaveis = obterFocaveis(modalAtivoEl);
            if (focaveis.length === 0) return;
            const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
            if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
            else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
        }

        function abrir(modalEl, callbackFechar) {
            elementoFocoAnterior = document.activeElement;
            modalAtivoEl = modalEl;
            onFechar = callbackFechar || null;
            modalEl.style.display = 'flex';
            document.addEventListener('keydown', trapFocusHandler);
            const focaveis = obterFocaveis(modalEl);
            if (focaveis.length > 0) focaveis[0].focus();
            else {
                const conteudo = modalEl.querySelector('[tabindex="-1"]');
                if (conteudo) conteudo.focus();
            }
        }

        function fechar() {
            if (!modalAtivoEl) return;
            modalAtivoEl.style.display = 'none';
            if (onFechar) onFechar();
            document.removeEventListener('keydown', trapFocusHandler);
            if (elementoFocoAnterior && typeof elementoFocoAnterior.focus === 'function') {
                elementoFocoAnterior.focus();
            }
            modalAtivoEl = null;
            elementoFocoAnterior = null;
            onFechar = null;
        }

        return { abrir, fechar };
    }

    global.EconomizeiUtils = {
        sanitize,
        ensureHttps,
        linkSeguro,
        gerarSlug,
        parseCSV,
        criarCacheCSV,
        criarGerenciadorFavoritos,
        gerarURLQRCode,
        gerarImagemQRCode,
        criarModalAcessivel
    };
})(window);