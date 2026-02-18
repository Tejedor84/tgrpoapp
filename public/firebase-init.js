import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCVfWttaxgZsohcpgoWmZp_aLLCmgOLdLc",
    authDomain: "tg-pro-a7e7a.firebaseapp.com",
    projectId: "tg-pro-a7e7a",
    storageBucket: "tg-pro-a7e7a.firebasestorage.app",
    messagingSenderId: "140414984902",
    appId: "1:140414984902:web:d1887f2b32a1254661adc7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- ATIVA O MODO OFFLINE/CACHE PARA MAIOR VELOCIDADE ---
enableIndexedDbPersistence(db)
  .catch((err) => {
      if (err.code == 'failed-precondition') {
          console.log('Muitas abas abertas. O modo offline só funciona em uma.');
      } else if (err.code == 'unimplemented') {
          console.log('Navegador não suporta persistência.');
      }
  });

export { auth, db };