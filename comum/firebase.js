/* ==============================================================
   ECONOMIZEI! RIO CLARO — FIREBASE
   Inicializa uma única vez por página e expõe as referências
   compartilhadas em window.EconomizeiFirebase.
   Depende dos SDKs firebase-app/firestore/auth-compat carregados antes.
   ============================================================== */
(function (global) {
    'use strict';

    var cfg = {
        apiKey: "AIzaSyDrNlMrrlYJhC78ALOBUdr8bSJ7ykLs_O4",
        authDomain: "economizeirioclaro.firebaseapp.com",
        projectId: "economizeirioclaro",
        storageBucket: "economizeirioclaro.firebasestorage.app",
        messagingSenderId: "243852155427",
        appId: "1:243852155427:web:57bcc18ca6b329f1bc6f96"
    };

    if (!global.firebase) {
        console.error('[EconomizeiFirebase] SDK do Firebase não carregado antes deste script.');
        return;
    }
    if (!firebase.apps.length) firebase.initializeApp(cfg);
firebase.firestore().settings({ experimentalAutoDetectLongPolling: true, merge: true });
    var EF = global.EconomizeiFirebase = {
        db: firebase.firestore(),
        auth: firebase.auth(),
        provider: new firebase.auth.GoogleAuthProvider()
    };

    /* ----------------------------------------------------------
       LOGIN GOOGLE UNIFICADO (site + app Android)
       O Google recusa signInWithPopup/Redirect dentro da WebView do app
       (disallowed_useragent). Quando o app expõe Android.iniciarLoginGoogle,
       o login é nativo e o app devolve o idToken em window.onLoginSuccess /
       window.onLoginError (contrato fixo da CategoriasActivity).
       Todas as páginas devem usar EconomizeiFirebase.loginGoogle().
       ---------------------------------------------------------- */
    function erroLogin(code, msg) {
        var e = new Error(msg);
        e.code = code;
        return e;
    }

    EF.noApp = function () {
        return !!(global.Android && typeof global.Android.iniciarLoginGoogle === 'function');
    };

    /* Handlers globais permanentes (contrato fixo do app: o app chama
       javascript:onLoginSuccess(idToken) / onLoginError(msg)). Ficam definidos
       desde o carregamento da página, para funcionarem mesmo se a WebView
       recarregar a página enquanto a tela nativa do Google está aberta. */
    var loginPendente = null;

    global.onLoginSuccess = function (idToken) {
        var p = loginPendente; loginPendente = null;
        if (!idToken) {
            var e = erroLogin('app/sem-token', 'Não foi possível obter o token do Google.');
            if (p) p.reject(e); else console.error('[EconomizeiFirebase]', e.message);
            return;
        }
        var cred = firebase.auth.GoogleAuthProvider.credential(idToken);
        EF.auth.signInWithCredential(cred).then(function (r) {
            if (p) p.resolve(r.user);   // sem pendência (página recarregada): onAuthStateChanged assume
        }, function (err) {
            if (p) p.reject(err); else { console.error('[EconomizeiFirebase]', err); alert('Erro ao fazer login. Tente novamente.'); }
        });
    };
    global.onLoginError = function (msg) {
        var p = loginPendente; loginPendente = null;
        var e = erroLogin('app/login-error', msg || 'Falha no login.');
        if (p) p.reject(e); else { console.error('[EconomizeiFirebase]', e.message); alert('Erro ao fazer login: ' + e.message); }
    };

    /* opts: { rating, nome } repassados ao app (avaliação pendente);
             modoWeb: 'popup' (padrão) ou 'redirect' (fora do app).
       Retorna Promise<user>. No modo redirect (fora do app) a página navega
       e o resultado vem por getRedirectResult()/onAuthStateChanged. */
    EF.loginGoogle = function (opts) {
        opts = opts || {};
        if (!EF.noApp()) {
            if (opts.modoWeb === 'redirect') return EF.auth.signInWithRedirect(EF.provider);
            return EF.auth.signInWithPopup(EF.provider).then(function (r) { return r.user; });
        }
        return new Promise(function (resolve, reject) {
            loginPendente = { resolve: resolve, reject: reject };
            try {
                // O app espera 3 Strings; passa sempre strings (nunca número)
                global.Android.iniciarLoginGoogle(opts.rating != null ? String(opts.rating) : '', '', opts.nome ? String(opts.nome) : '');
            } catch (e) { loginPendente = null; reject(e); }
        });
    };
})(window);
