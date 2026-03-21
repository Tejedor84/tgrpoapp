import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ESTADO ---
let deals = [];
let currentUserEmail = "";

// --- COLUNAS DO KANBAN ---
const COLUNAS = ["Prospecção", "Qualificação", "Proposta", "Negociação", "Fechado"];
const COL_IDS = {
    "Prospecção":  "col-prospeccao",
    "Qualificação":"col-qualificacao",
    "Proposta":    "col-proposta",
    "Negociação":  "col-negociacao",
    "Fechado":     "col-fechado"
};

// --- ELEMENTOS ---
const modal      = document.getElementById('modalDeal');
const form       = document.getElementById('formDeal');
const btnNewDeal = document.getElementById('btnNewDeal');
const btnCancel  = document.getElementById('btnCancel');
const closeModal = document.getElementById('closeModal');

// --- 1. AUTENTICAÇÃO ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserEmail = user.email;
        document.getElementById('user-email').textContent = user.email;
        iniciarListener();
    } else {
        window.location.href = "index.html";
    }
});

// --- 2. LISTENER REALTIME ---
function iniciarListener() {
    const q = query(collection(db, "crm_deals"), orderBy("criadoEm", "desc"));

    onSnapshot(q, (snapshot) => {
        deals = [];
        snapshot.forEach(docSnap => {
            deals.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderizarKanban();
    }, (error) => {
        console.error("Erro CRM:", error);
    });
}

// --- 3. RENDERIZAÇÃO ---
function renderizarKanban() {
    // Limpa o conteúdo de cada coluna
    COLUNAS.forEach(status => {
        const col = document.getElementById(COL_IDS[status]);
        if (col) col.querySelector('.column-content').innerHTML = '';
    });

    let totalGeral = 0;

    deals.forEach(deal => {
        const colId = COL_IDS[deal.status];
        if (!colId) return;

        const col = document.getElementById(colId);
        if (!col) return;

        const valor = parseFloat(deal.valor || 0);
        totalGeral += valor;

        const valorFmt = valor > 0
            ? valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            : '—';

        const card = document.createElement('div');
        card.className = 'deal-card';
        card.draggable = true;
        card.dataset.id = deal.id;

        card.innerHTML = `
            <div class="deal-title">${deal.titulo}</div>
            <div class="deal-value">${valorFmt}</div>
            ${deal.responsavel ? `<div class="deal-owner">👤 ${deal.responsavel}</div>` : ''}
            ${deal.obs ? `<div class="deal-obs">${deal.obs}</div>` : ''}
            <div class="deal-actions">
                <button class="btn-deal-edit" onclick="editarDeal('${deal.id}')">✏️</button>
                <button class="btn-deal-del"  onclick="excluirDeal('${deal.id}')">🗑️</button>
            </div>
        `;

        // Drag events
        card.addEventListener('dragstart', onDragStart);
        card.addEventListener('dragend',   onDragEnd);

        col.querySelector('.column-content').appendChild(card);
    });

    // Atualiza contadores e totais por coluna
    COLUNAS.forEach(status => {
        const col = document.getElementById(COL_IDS[status]);
        if (!col) return;

        const cards = col.querySelectorAll('.deal-card');
        const header = col.querySelector('.column-header');

        // Remove contador antigo
        const oldCount = header.querySelector('.col-count');
        if (oldCount) oldCount.remove();

        const count = document.createElement('span');
        count.className = 'col-count';
        count.textContent = cards.length;
        header.appendChild(count);
    });
}

// --- 4. DRAG AND DROP ---
let draggedId = null;

function onDragStart(e) {
    draggedId = e.currentTarget.dataset.id;
    e.currentTarget.classList.add('dragging');
}

function onDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
}

// Vincula eventos nas colunas
document.querySelectorAll('.kanban-column').forEach(col => {
    col.addEventListener('dragover', (e) => {
        e.preventDefault();
        col.classList.add('drag-over');
    });

    col.addEventListener('dragleave', () => {
        col.classList.remove('drag-over');
    });

    col.addEventListener('drop', async (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');

        const novoStatus = col.dataset.status;
        if (!draggedId || !novoStatus) return;

        try {
            await updateDoc(doc(db, "crm_deals", draggedId), { status: novoStatus });
        } catch (err) {
            console.error("Erro ao mover card:", err);
            alert("Erro ao mover oportunidade.");
        }

        draggedId = null;
    });
});

// --- 5. MODAL ---
btnNewDeal.addEventListener('click', () => {
    form.reset();
    document.getElementById('dealId').value = '';
    document.getElementById('modalTitle').textContent = 'Nova Oportunidade';
    modal.classList.remove('hidden');
});

const fechar = () => {
    modal.classList.add('hidden');
    form.reset();
};

closeModal.addEventListener('click', fechar);
btnCancel.addEventListener('click', fechar);
modal.addEventListener('click', (e) => { if (e.target === modal) fechar(); });

// --- 6. SALVAR ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id     = document.getElementById('dealId').value;
    const titulo = document.getElementById('dealTitle').value.trim();
    const valor  = parseFloat(document.getElementById('dealValue').value) || 0;
    const status = document.getElementById('dealStatus').value;
    const resp   = document.getElementById('dealOwner').value.trim();
    const obs    = document.getElementById('dealObs').value.trim();

    if (!titulo) return alert("Digite o título da oportunidade.");

    const dados = { titulo, valor, status, responsavel: resp, obs };

    try {
        if (id) {
            await updateDoc(doc(db, "crm_deals", id), dados);
        } else {
            dados.criadoPor  = currentUserEmail;
            dados.criadoEm   = serverTimestamp();
            await addDoc(collection(db, "crm_deals"), dados);
        }
        fechar();
    } catch (err) {
        alert("Erro ao salvar: " + err.message);
    }
});

// --- 7. EDITAR / EXCLUIR ---
window.editarDeal = (id) => {
    const deal = deals.find(d => d.id === id);
    if (!deal) return;

    document.getElementById('dealId').value      = deal.id;
    document.getElementById('dealTitle').value   = deal.titulo || '';
    document.getElementById('dealValue').value   = deal.valor  || '';
    document.getElementById('dealStatus').value  = deal.status || 'Prospecção';
    document.getElementById('dealOwner').value   = deal.responsavel || '';
    document.getElementById('dealObs').value     = deal.obs    || '';
    document.getElementById('modalTitle').textContent = 'Editar Oportunidade';

    modal.classList.remove('hidden');
};

window.excluirDeal = async (id) => {
    if (confirm("Excluir esta oportunidade?")) {
        try {
            await deleteDoc(doc(db, "crm_deals", id));
        } catch (err) {
            alert("Erro ao excluir: " + err.message);
        }
    }
};