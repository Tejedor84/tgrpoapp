/* =================================================================
   ORCAMENTOS-LISTA.JS — Lista de propostas com busca e filtros
   ================================================================= */
import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let todasPropostas = [];

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('user-email').textContent = user.email;
        carregarPropostas();
    } else {
        window.location.href = "index.html";
    }
});

// Busca e filtro em tempo real
document.getElementById('inpBusca').addEventListener('input', filtrar);
document.getElementById('selStatus').addEventListener('change', filtrar);

async function carregarPropostas() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '<tr><td colspan="8" class="loading-cell">Carregando...</td></tr>';

    try {
        const q    = query(collection(db, "orcamentos"), orderBy("dataCriacao", "desc"));
        const snap = await getDocs(q);

        todasPropostas = [];
        snap.forEach(docSnap => {
            todasPropostas.push({ id: docSnap.id, ...docSnap.data() });
        });

        renderizar(todasPropostas);
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="8" class="loading-cell">Erro ao carregar propostas.</td></tr>';
    }
}

function filtrar() {
    const termo  = document.getElementById('inpBusca').value.toLowerCase().trim();
    const status = document.getElementById('selStatus').value;

    const filtradas = todasPropostas.filter(p => {
        const empresa  = (p.cliente?.empresa || p.cliente?.nome || '').toLowerCase();
        const contato  = (p.cliente?.contato || '').toLowerCase();
        const proposta = (p.proposta || '').toLowerCase();

        const matchTexto = !termo || empresa.includes(termo) || contato.includes(termo) || proposta.includes(termo);
        const matchStatus = !status || p.status === status;

        return matchTexto && matchStatus;
    });

    renderizar(filtradas);
}

function renderizar(lista) {
    const tbody      = document.getElementById('tableBody');
    const emptyState = document.getElementById('emptyState');

    if (lista.length === 0) {
        tbody.innerHTML  = '';
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';
    tbody.innerHTML = '';

    lista.forEach(p => {
        const empresa  = p.cliente?.empresa || p.cliente?.nome || '—';
        const contato  = p.cliente?.contato || '—';
        const dataEvento = p.evento?.dataInicio || '—';
        const total    = p.financeiro?.totalFinal || p.total || '—';
        const status   = p.status || 'Rascunho';
        const data     = p.dataProposta || '—';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="proposta-num">${p.proposta || '—'}</td>
            <td><strong>${empresa}</strong></td>
            <td>${contato}</td>
            <td>${data}</td>
            <td>${dataEvento}</td>
            <td class="total-cell">${total}</td>
            <td><span class="status-badge status-${status.toLowerCase()}">${status}</span></td>
            <td class="actions-cell">
                <button class="btn-action btn-edit" title="Editar" onclick="editarProposta('${p.id}')">✏️</button>
                <button class="btn-action btn-delete" title="Excluir" onclick="excluirProposta('${p.id}', '${p.proposta || ''}')">🗑️</button>
            </td>`;

        // Clique na linha abre edição
        tr.addEventListener('click', (e) => {
            if (!e.target.closest('.actions-cell')) editarProposta(p.id);
        });
        tr.style.cursor = 'pointer';

        tbody.appendChild(tr);
    });
}

window.editarProposta = function(id) {
    window.location.href = `orcamentos.html?id=${id}`;
};

window.excluirProposta = async function(id, num) {
    if (!confirm(`Excluir proposta ${num}? Esta ação não pode ser desfeita.`)) return;
    try {
        await deleteDoc(doc(db, "orcamentos", id));
        todasPropostas = todasPropostas.filter(p => p.id !== id);
        filtrar();
    } catch (e) {
        alert("Erro ao excluir: " + e.message);
    }
};