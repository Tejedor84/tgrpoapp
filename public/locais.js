/* =================================================================
   LOCAIS.JS - PADRONIZADO COM BUSCA INTELIGENTE
   ================================================================= */

import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let locaisCadastrados = [];
const filterText = document.getElementById('filterText');

// --- INICIALIZAÇÃO E AUTENTICAÇÃO ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('user-email').textContent = user.email;
        iniciarListenerLocais();
    } else {
        window.location.href = "index.html";
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Fechar modal ao clicar fora
    const modal = document.getElementById('modalLocal');
    window.onclick = function(event) {
        if (event.target == modal) {
            window.fecharModal();
        }
    }
});

// --- OUVINTE EM TEMPO REAL E RENDERIZAÇÃO ---
function iniciarListenerLocais() {
    const q = query(collection(db, "locais"), orderBy("nome"));
    
    onSnapshot(q, (snapshot) => {
        locaisCadastrados = [];
        snapshot.forEach(doc => {
            locaisCadastrados.push({ id: doc.id, ...doc.data() });
        });
        renderizarLocais();
    }, (error) => {
        console.error("Erro ao carregar locais:", error);
    });
}

function renderizarLocais() {
    const lista = document.getElementById('lista-locais');
    const termo = filterText.value.toLowerCase().trim();

    lista.innerHTML = '';

    const filtrados = locaisCadastrados.filter(local => {
        const nome = (local.nome || "").toLowerCase();
        const endereco = (local.endereco || "").toLowerCase();
        const obs = (local.obs || "").toLowerCase();
        
        return nome.includes(termo) || endereco.includes(termo) || obs.includes(termo);
    });

    if (filtrados.length === 0) {
        lista.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhum local encontrado.</td></tr>';
        return;
    }

    filtrados.forEach((local) => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td><strong>${local.nome || 'Sem nome'}</strong></td>
            <td>${local.endereco || '-'}</td>
            <td>${local.obs || '-'}</td>
            <td style="text-align:center;">
                <button class="btn-icon" onclick="excluirLocal('${local.id}')" title="Excluir" style="color:var(--danger-color);">
                    🗑️
                </button>
            </td>
        `;
        lista.appendChild(tr);
    });
}

// Atualiza a tabela enquanto digita
if(filterText) filterText.addEventListener('input', renderizarLocais);

// --- FUNÇÕES DE MODAL ---
window.abrirModal = function() {
    const modal = document.getElementById('modalLocal');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            document.getElementById('nomeLocal').focus();
        }, 100);
    }
}

window.fecharModal = function() {
    const modal = document.getElementById('modalLocal');
    if (modal) {
        modal.classList.add('hidden');
        document.getElementById('formLocal').reset();
    }
}

// --- SALVAR E EXCLUIR ---
window.salvarLocal = async function(event) {
    if(event) event.preventDefault();

    const nome = document.getElementById('nomeLocal').value.trim();
    const endereco = document.getElementById('enderecoLocal').value.trim();
    const obs = document.getElementById('obsLocal').value.trim();

    if (!nome) return alert("Por favor, digite o nome do local.");

    const btnSalvar = document.getElementById('btnSalvar');
    if (btnSalvar) {
        btnSalvar.innerText = "Salvando...";
        btnSalvar.disabled = true;
    }

    try {
        await addDoc(collection(db, "locais"), {
            nome: nome,
            endereco: endereco,
            obs: obs,
            dataCriacao: serverTimestamp(),
            criadoPor: auth.currentUser ? auth.currentUser.email : "Admin"
        });
        
        window.fecharModal();
    } catch (error) {
        console.error("Erro ao salvar local:", error);
        alert("Erro ao salvar: " + error.message);
    } finally {
        if (btnSalvar) {
            btnSalvar.innerText = "Salvar Local";
            btnSalvar.disabled = false;
        }
    }
}

window.excluirLocal = async function(id) {
    if (confirm("Tem certeza que deseja excluir este local?")) {
        try {
            await deleteDoc(doc(db, "locais", id));
        } catch (error) {
            console.error("Erro ao excluir:", error);
            alert("Erro ao excluir: " + error.message);
        }
    }
}