import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { verificarPermissao } from "./auth-guard.js";

const userEmailSpan = document.getElementById('user-email');
const btnLogout = document.getElementById('btnLogout');
const inpNewTask = document.getElementById('inpNewTask');
const btnAddTask = document.getElementById('btnAddTask');
const pendenciasList = document.getElementById('pendenciasList');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        if(userEmailSpan) userEmailSpan.textContent = user.email;
        await verificarPermissao(db, user.email);
        carregarPendencias();
    } else {
        window.location.href = "index.html";
    }
});

if(btnLogout) btnLogout.addEventListener('click', () => signOut(auth).then(() => window.location.href = "index.html"));

function carregarPendencias() {
    // Ordena por status (pendentes primeiro) e depois data
    const q = query(collection(db, "pendencias"), orderBy("concluido"), orderBy("criadoEm", "desc"));
    
    onSnapshot(q, (snapshot) => {
        pendenciasList.innerHTML = "";
        snapshot.forEach(docSnap => {
            const task = docSnap.data();
            const id = docSnap.id;
            
            const li = document.createElement('li');
            li.className = task.concluido ? "completed" : "";
            
            li.innerHTML = `
                <span onclick="toggleTask('${id}', ${task.concluido})">${task.texto}</span>
                <button onclick="excluirTask('${id}')" class="btn-trash">🗑️</button>
            `;
            pendenciasList.appendChild(li);
        });
    });
}

if(btnAddTask) {
    btnAddTask.addEventListener('click', async () => {
        const texto = inpNewTask.value;
        if(!texto) return;
        
        try {
            await addDoc(collection(db, "pendencias"), {
                texto: texto,
                concluido: false,
                criadoEm: new Date().toISOString()
            });
            inpNewTask.value = "";
        } catch(e) { console.error(e); }
    });
}

window.toggleTask = async (id, statusAtual) => {
    try { await updateDoc(doc(db, "pendencias", id), { concluido: !statusAtual }); }
    catch(e) { console.error(e); }
};

window.excluirTask = async (id) => {
    try { await deleteDoc(doc(db, "pendencias", id)); }
    catch(e) { console.error(e); }
};