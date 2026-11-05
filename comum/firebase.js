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
            global.onLoginSuccess = function (idToken) {
                if (!idToken) { reject(erroLogin('app/sem-token', 'Não foi possível obter o token do Google.')); return; }
                var cred = firebase.auth.GoogleAuthProvider.credential(idToken);
                EF.auth.signInWithCredential(cred).then(function (r) { resolve(r.user); }, reject);
            };
            global.onLoginError = function (msg) {
                reject(erroLogin('app/login-error', msg || 'Falha no login.'));
            };
            try {
                global.Android.iniciarLoginGoogle(opts.rating != null ? String(opts.rating) : '', 0, opts.nome || '');
            } catch (e) { reject(e); }
        });
    };
})(window);
