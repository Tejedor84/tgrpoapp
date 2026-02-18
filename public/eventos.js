import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- SEGURANÇA ---
import { verificarPermissao } from "./auth-guard.js";

// Elementos Globais
const userEmailSpan = document.getElementById('user-email');
const btnLogout = document.getElementById('btnLogout');

// Elementos da Lista e Filtro
const tableBody = document.getElementById('eventsList'); // ID CORRIGIDO
const searchInput = document.getElementById('searchInput'); // ID CORRIGIDO
const btnHistory = document.getElementById('btnHistory');
const pageTitle = document.querySelector('.page-header h3');

// Elementos CRUD
const btnNewEvent = document.getElementById('btnNewEvent');
const modal = document.getElementById('modalEvent');
const closeModal = document.getElementById('closeModal');
const btnCancel = document.getElementById('btnCancel');
const form = document.getElementById('formEvent');

// Campos do Modal (IDs SINCRONIZADOS)
const modalTitle = document.getElementById('modalTitle');
const eventIdInput = document.getElementById('eventId');
const inpName = document.getElementById('eventName');
const inpDateStart = document.getElementById('eventDateStart');
const inpDateEnd = document.getElementById('eventDateEnd');
const inpLocal = document.getElementById('eventLocation'); // Select
const inpStatus = document.getElementById('eventStatus');
const inpType = document.getElementById('eventType'); // Adicionado ao HTML
const inpObs = document.getElementById('eventObs');   // Adicionado ao HTML

// Estado
let listaEventos = [];
let modoHistorico = false;
let unsubscribe = null;

// --- 1. INICIALIZAÇÃO SEGURA ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        if(userEmailSpan) userEmailSpan.textContent = user.email;

        // VERIFICA PERMISSÃO
        await verificarPermissao(db, user.email);

        await carregarLocaisNoSelect(); // Preenche o select de locais
        carregarEventos(); // Carrega a tabela
    } else {
        window.location.href = "index.html";
    }
});

if(btnLogout) {
    btnLogout.addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = "index.html");
    });
}

// --- 2. CARREGAMENTO DE DADOS ---

// Função Auxiliar: Preencher Select de Locais
async function carregarLocaisNoSelect() {
    if(!inpLocal) return;
    try {
        const q = query(collection(db, "locais"), orderBy("nome"));
        const snapshot = await getDocs(q);
        
        inpLocal.innerHTML = '<option value="">Selecione um local...</option>';
        
        snapshot.forEach(doc => {
            const l = doc.data();
            const option = document.createElement('option');
            option.value = l.nome; // Salvamos o nome do local
            option.textContent = l.nome;
            inpLocal.appendChild(option);
        });
    } catch (e) {
        console.error("Erro ao carregar locais:", e);
    }
}

function carregarEventos() {
    // Limpa listener anterior
    if(unsubscribe) { unsubscribe(); unsubscribe = null; }

    const hoje = new Date().toISOString().split('T')[0];
    let q;

    if (modoHistorico) {
        // Histórico (Anteriores a hoje)
        q = query(collection(db, "events"), where("dataInicio", "<", hoje), orderBy("dataInicio", "desc"));
        if(pageTitle) pageTitle.textContent = "Histórico de Eventos";
        if(btnHistory) {
            btnHistory.textContent = "Voltar para Futuros";
            btnHistory.style.border = "1px solid #fff";
            btnHistory.style.color = "#fff";
        }
    } else {
        // Futuros (Hoje em diante)
        q = query(collection(db, "events"), where("dataInicio", ">=", hoje), orderBy("dataInicio", "asc"));
        if(pageTitle) pageTitle.textContent = "Próximos Eventos";
        if(btnHistory) {
            btnHistory.textContent = "📜 Ver Histórico";
            btnHistory.style.border = "1px solid #FFD700";
            btnHistory.style.color = "#FFD700";
        }
    }

    unsubscribe = onSnapshot(q, (snapshot) => {
        listaEventos = [];
        tableBody.innerHTML = "";
        
        if (snapshot.empty) {
            const msg = modoHistorico ? "Nenhum evento no histórico." : "Nenhum evento próximo.";
            tableBody.innerHTML = `<tr><td colspan="6" align="center">${msg}</td></tr>`;
            return;
        }

        snapshot.forEach(doc => {
            let ev = doc.data();
            ev.id = doc.id;
            listaEventos.push(ev);
        });
        filtrarTabela();
    });
}

// Botão de Alternar Histórico
if(btnHistory) {
    btnHistory.addEventListener('click', () => {
        modoHistorico = !modoHistorico;
        if(searchInput) searchInput.value = "";
        carregarEventos();
    });
}

// Filtro Local
function filtrarTabela() {
    const termo = searchInput ? searchInput.value.toLowerCase() : "";
    
    // Filtra na memória
    const filtrados = listaEventos.filter(e => 
        (e.nome && e.nome.toLowerCase().includes(termo)) || 
        (e.local && e.local.toLowerCase().includes(termo)) ||
        (e.status && e.status.toLowerCase().includes(termo))
    );
    
    renderizarTabela(filtrados);
}

if(searchInput) searchInput.addEventListener('input', filtrarTabela);

function renderizarTabela(lista) {
    tableBody.innerHTML = "";
    
    if(lista.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" align="center">Nenhum resultado encontrado.</td></tr>`;
        return;
    }

    lista.forEach(ev => {
        const tr = document.createElement('tr');
        
        // Formata data DD/MM/YYYY
        let dataF = ev.dataInicio;
        if(ev.dataInicio && ev.dataInicio.includes('-')) {
            const p = ev.dataInicio.split('-');
            dataF = `${p[2]}/${p[1]}/${p[0]}`;
        }
        
        // Badge de Status
        let badgeClass = 'status-pendente';
        if(ev.status === 'Confirmado' || ev.status === 'Realizado') badgeClass = 'status-confirmado';
        if(ev.status === 'Cancelado') badgeClass = 'status-cancelado';
        if(ev.status === 'Finalizado') badgeClass = 'status-finalizado';

        tr.innerHTML = `
            <td>${dataF}</td>
            <td><strong>${ev.nome}</strong></td>
            <td>${ev.local || '-'}</td>
            <td>${ev.tipo || 'Geral'}</td>
            <td><span class="status-badge ${badgeClass}">${ev.status}</span></td>
            <td>
                <div class="actions-cell">
                    <button class="btn-icon-edit" onclick="editarEvento('${ev.id}')" title="Editar">✏️</button>
                    <button class="btn-icon-delete" onclick="excluirEvento('${ev.id}')" title="Excluir">🗑️</button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

// --- 3. MODAL E CRUD ---
function abrirModal(modo = 'criar') {
    modal.classList.remove('hidden');
    if(modo === 'criar') {
        form.reset();
        eventIdInput.value = "";
        modalTitle.textContent = "Novo Evento";
        if(inpDateStart) inpDateStart.valueAsDate = new Date();
    } else {
        modalTitle.textContent = "Editar Evento";
    }
}

function fecharModal() { modal.classList.add('hidden'); }

if(btnNewEvent) btnNewEvent.addEventListener('click', () => abrirModal('criar'));
if(closeModal) closeModal.addEventListener('click', fecharModal);
if(btnCancel) btnCancel.addEventListener('click', fecharModal);

// Salvar
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Salvando...";

    const dados = {
        nome: inpName.value,
        dataInicio: inpDateStart.value,
        dataFim: inpDateEnd.value,
        local: inpLocal.value,
        status: inpStatus.value,
        tipo: inpType ? inpType.value : "Corporativo",
        obs: inpObs ? inpObs.value : ""
    };

    const id = eventIdInput.value;
    try {
        if(id) {
            await updateDoc(doc(db, "events", id), dados);
        } else {
            await addDoc(collection(db, "events"), dados);
        }
        fecharModal();
    } catch(err) {
        alert("Erro ao salvar: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Salvar Evento";
    }
});

// Editar (Função Global)
window.editarEvento = (id) => {
    const ev = listaEventos.find(e => e.id === id);
    if(ev) {
        eventIdInput.value = ev.id;
        inpName.value = ev.nome;
        inpDateStart.value = ev.dataInicio;
        inpDateEnd.value = ev.dataFim;
        inpLocal.value = ev.local;
        inpStatus.value = ev.status;
        if(inpType) inpType.value = ev.tipo || 'Corporativo';
        if(inpObs) inpObs.value = ev.obs || '';
        abrirModal('editar');
    }
};

// Excluir (Função Global)
window.excluirEvento = async (id) => {
    if(confirm("Tem certeza que deseja excluir este evento?")) {
        try { await deleteDoc(doc(db, "events", id)); }
        catch(e) { console.error(e); alert("Erro ao excluir."); }
    }
};