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
    global.EconomizeiFirebase = {
        db: firebase.firestore(),
        auth: firebase.auth(),
        provider: new firebase.auth.GoogleAuthProvider()
    };
})(window);
