/* =================================================================
   PENDENCIAS.JS - Reescrito para o kanban do HTML atual
   ================================================================= */
import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let tarefasCache = [];

// --- ELEMENTOS ---
const modal      = document.getElementById('modalTask');
const form       = document.getElementById('formTask');
const btnNewTask = document.getElementById('btnNewTask');
const btnCancel  = document.getElementById('btnCancel');
const closeModal = document.getElementById('closeModal');
const searchInput = document.getElementById('searchInput');

// --- AUTH ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('user-email').textContent = user.email;
        iniciarListener();
    } else {
        window.location.href = "index.html";
    }
});

// --- LISTENER REALTIME ---
function iniciarListener() {
    const q = query(collection(db, "pendencias"), orderBy("criadoEm", "desc"));
    onSnapshot(q, (snap) => {
        tarefasCache = [];
        snap.forEach(d => tarefasCache.push({ id: d.id, ...d.data() }));
        renderizarKanban();
    });
}

// --- RENDERIZAR KANBAN ---
function renderizarKanban() {
    const termo = (searchInput?.value || '').toLowerCase();

    const colunas = { todo: [], doing: [], done: [] };

    tarefasCache.forEach(t => {
        if (termo && !(t.descricao || '').toLowerCase().includes(termo)) return;
        const col = t.status || 'todo';
        if (colunas[col]) colunas[col].push(t);
    });

    Object.entries(colunas).forEach(([status, tarefas]) => {
        const lista = document.getElementById(`list-${status}`);
        if (!lista) return;
        lista.innerHTML = '';

        if (tarefas.length === 0) {
            lista.innerHTML = `<p style="color:#555; font-size:0.85rem; text-align:center; padding:16px 0;">Nenhuma tarefa.</p>`;
            return;
        }

        tarefas.forEach(t => {
            const prioridadeColor = t.prioridade === 'Alta' ? '#e04a4a'
                : t.prioridade === 'Media' ? '#e0a04a' : '#4a9ae0';

            const card = document.createElement('div');
            card.className = 'task-card';
            card.style.cssText = 'background:var(--bg-input); border:1px solid var(--border-color); border-radius:6px; padding:12px; margin-bottom:8px;';

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:8px;">
                    <span style="font-size:0.9rem; color:var(--text-main); line-height:1.4;">${t.descricao || ''}</span>
                    <span style="flex-shrink:0; font-size:0.7rem; padding:2px 7px; border-radius:99px; background:${prioridadeColor}22; color:${prioridadeColor}; font-weight:600;">${t.prioridade || 'Baixa'}</span>
                </div>
                ${t.responsavel ? `<div style="font-size:0.78rem; color:var(--text-muted);">👤 ${t.responsavel}</div>` : ''}
                <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:10px; border-top:1px solid var(--border-color); padding-top:8px;">
                    ${status !== 'todo'   ? `<button onclick="moverTarefa('${t.id}', '${prevStatus(status)}')" style="font-size:0.75rem; padding:3px 8px;" class="btn-secondary">◀</button>` : ''}
                    ${status !== 'done'   ? `<button onclick="moverTarefa('${t.id}', '${nextStatus(status)}')" style="font-size:0.75rem; padding:3px 8px;" class="btn-secondary">▶</button>` : ''}
                    <button onclick="excluirTarefa('${t.id}')" style="font-size:0.75rem; padding:3px 8px; border-color:#ff4d4d; color:#ff4d4d;" class="btn-secondary">🗑️</button>
                </div>
            `;
            lista.appendChild(card);
        });
    });
}

function nextStatus(s) { return s === 'todo' ? 'doing' : 'done'; }
function prevStatus(s) { return s === 'done' ? 'doing' : 'todo'; }

searchInput?.addEventListener('input', renderizarKanban);

// --- MODAL ---
btnNewTask?.addEventListener('click', () => {
    form.reset();
    document.getElementById('taskId').value = '';
    document.getElementById('modalTitle').textContent = 'Nova Tarefa';
    modal.style.display = 'flex';
});

const fechar = () => { modal.style.display = 'none'; form.reset(); };
closeModal?.addEventListener('click', fechar);
btnCancel?.addEventListener('click', fechar);
modal?.addEventListener('click', (e) => { if (e.target === modal) fechar(); });

// --- SALVAR ---
form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;

    const dados = {
        descricao:   document.getElementById('taskDesc').value.trim(),
        prioridade:  document.getElementById('taskPriority').value,
        responsavel: document.getElementById('taskOwner').value.trim(),
        status:      document.getElementById('taskStatus').value,
        criadoEm:    serverTimestamp()
    };

    try {
        const id = document.getElementById('taskId').value;
        if (id) {
            delete dados.criadoEm;
            await updateDoc(doc(db, "pendencias", id), dados);
        } else {
            await addDoc(collection(db, "pendencias"), dados);
        }
        fechar();
    } catch (err) {
        alert("Erro ao salvar: " + err.message);
    } finally {
        btn.disabled = false;
    }
});

// --- MOVER / EXCLUIR ---
window.moverTarefa = async (id, novoStatus) => {
    try { await updateDoc(doc(db, "pendencias", id), { status: novoStatus }); }
    catch (e) { alert("Erro: " + e.message); }
};

window.excluirTarefa = async (id) => {
    if (confirm("Excluir esta tarefa?")) {
        try { await deleteDoc(doc(db, "pendencias", id)); }
        catch (e) { alert("Erro: " + e.message); }
    }
};