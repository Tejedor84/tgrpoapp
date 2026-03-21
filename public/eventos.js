/* =================================================================
   EVENTOS.JS - V3 (COM EQUIPE)
   ================================================================= */

import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, 
    addDoc, 
    deleteDoc, 
    doc, 
    query, 
    orderBy, 
    getDocs,
    onSnapshot,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let listaEventos = [];

// --- 1. AUTENTICAÇÃO ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('user-email').textContent = user.email;
        carregarLocaisParaSelect();
        carregarEquipeParaSelecao(); // <--- Novo: Carrega a equipe
        iniciarListenerEventos();
    } else {
        window.location.href = "index.html";
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const filterStatus = document.getElementById('filterStatus');
    if(searchInput) searchInput.addEventListener('input', renderizarTabela);
    if(filterStatus) filterStatus.addEventListener('change', renderizarTabela);
});

// --- 2. CARREGAR DADOS AUXILIARES ---
async function carregarLocaisParaSelect() {
    const select = document.getElementById('eventLocation');
    if (!select) return;
    try {
        const q = query(collection(db, "locais"), orderBy("nome"));
        const snap = await getDocs(q);
        select.innerHTML = '<option value="">Selecione um local...</option>';
        snap.forEach(doc => {
            const local = doc.data();
            const option = document.createElement('option');
            option.value = local.nome;
            option.textContent = local.nome;
            select.appendChild(option);
        });
    } catch (error) { console.error("Erro locais:", error); }
}

async function carregarEquipeParaSelecao() {
    const container = document.getElementById('teamSelectionList');
    if (!container) return;
    try {
        // Busca tanto na coleção 'equipe' quanto 'usuarios' para garantir
        const q = query(collection(db, "equipe"), orderBy("nome"));
        const snap = await getDocs(q);
        
        container.innerHTML = '';
        
        if (snap.empty) {
            container.innerHTML = '<div style="color:#ccc; padding:5px;">Nenhum membro encontrado em "equipe".</div>';
            return;
        }

        snap.forEach(doc => {
            const membro = doc.data();
            const nome = membro.nome || "Sem Nome";
            
            // Cria o checkbox
            const div = document.createElement('div');
            div.className = 'team-checkbox-item';
            div.innerHTML = `
                <input type="checkbox" name="equipeSelecionada" value="${nome}" id="chk_${doc.id}">
                <label for="chk_${doc.id}">${nome}</label>
            `;
            container.appendChild(div);
        });
    } catch (error) { 
        console.error("Erro equipe:", error);
        container.innerHTML = '<div style="color:red;">Erro ao carregar equipe.</div>';
    }
}

// --- 3. LISTENER E TABELA ---
function iniciarListenerEventos() {
    const q = query(collection(db, "eventos"), orderBy("dataInicio", "asc"));
    onSnapshot(q, (snapshot) => {
        listaEventos = [];
        snapshot.forEach(doc => {
            listaEventos.push({ id: doc.id, ...doc.data() });
        });
        renderizarTabela();
    });
}

function renderizarTabela() {
    const tbody = document.getElementById('eventsList');
    const termo = document.getElementById('searchInput').value.toLowerCase();
    const statusFiltro = document.getElementById('filterStatus').value;

    tbody.innerHTML = '';

    const filtrados = listaEventos.filter(evento => {
        const nome = (evento.nome || "").toLowerCase();
        const local = (evento.local || "").toLowerCase();
        const status = (evento.status || "");
        const bateTexto = nome.includes(termo) || local.includes(termo);
        const bateStatus = statusFiltro === "" || status === statusFiltro;
        return bateTexto && bateStatus;
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">Nenhum evento encontrado.</td></tr>';
        return;
    }

    filtrados.forEach(evento => {
        const tr = document.createElement('tr');
        
        let badgeClass = 'status-pendente';
        if (evento.status === 'Confirmado') badgeClass = 'status-confirmado';
        if (evento.status === 'Cancelado') badgeClass = 'status-cancelado';
        if (evento.status === 'Finalizado') badgeClass = 'status-finalizado';

        // Formata Datas
        let dataInicioF = "-";
        if (evento.dataInicio) {
            const p = evento.dataInicio.split('-');
            dataInicioF = `${p[2]}/${p[1]}/${p[0]}`;
        }
        
        let dataMontagemF = "-";
        if (evento.montagem) {
            const d = new Date(evento.montagem);
            dataMontagemF = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        }

        // Formata Equipe
        let equipeHtml = '<span style="color:#666; font-size:12px;">-</span>';
        if (evento.equipe && Array.isArray(evento.equipe) && evento.equipe.length > 0) {
            const qtd = evento.equipe.length;
            const nomesTooltip = evento.equipe.join(', '); // Nomes aparecem ao passar o mouse
            equipeHtml = `<span class="team-count-badge" title="${nomesTooltip}">${qtd} Pessoas</span>`;
        }

        tr.innerHTML = `
            <td style="font-size:12px; color:#e67e22; font-weight:bold;">${dataMontagemF}</td>
            <td>${dataInicioF}</td>
            <td><strong>${evento.nome || "Sem nome"}</strong></td>
            <td>${evento.local || "-"}</td>
            <td>${equipeHtml}</td>
            <td><span class="status-badge ${badgeClass}">${evento.status}</span></td>
            <td style="text-align: center;">
                <button class="btn-icon btn-delete" onclick="window.excluirEvento('${evento.id}')" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- 4. MODAL ---
window.abrirModalEvento = function() {
    document.getElementById('modalEvent').classList.remove('hidden');
    // Limpa checkboxes
    document.querySelectorAll('input[name="equipeSelecionada"]').forEach(chk => chk.checked = false);
    setTimeout(() => document.getElementById('eventName').focus(), 100);
}

window.fecharModalEvento = function() {
    document.getElementById('modalEvent').classList.add('hidden');
    document.getElementById('formEvent').reset();
}

// --- 5. SALVAR ---
const form = document.getElementById('formEvent');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSalvarEvento');
        const txtOriginal = btn.innerText;
        btn.innerText = "Salvando...";
        btn.disabled = true;

        // Pega os membros selecionados
        const equipeSelecionada = [];
        document.querySelectorAll('input[name="equipeSelecionada"]:checked').forEach(chk => {
            equipeSelecionada.push(chk.value);
        });

        try {
            await addDoc(collection(db, "eventos"), {
                nome: document.getElementById('eventName').value,
                montagem: document.getElementById('eventMontagem').value,
                desmontagem: document.getElementById('eventDesmontagem').value,
                dataInicio: document.getElementById('eventDateStart').value,
                dataFim: document.getElementById('eventDateEnd').value,
                tipo: document.getElementById('eventType').value,
                status: document.getElementById('eventStatus').value,
                local: document.getElementById('eventLocation').value,
                obs: document.getElementById('eventObs').value,
                equipe: equipeSelecionada, // <--- Salva o array de nomes
                dataCriacao: serverTimestamp(),
                criadoPor: auth.currentUser.email
            });
            window.fecharModalEvento();
        } catch (error) {
            alert("Erro ao salvar: " + error.message);
        } finally {
            btn.innerText = txtOriginal;
            btn.disabled = false;
        }
    });
}

// --- 6. EXCLUIR ---
window.excluirEvento = async function(id) {
    if(confirm("Excluir evento permanentemente?")) {
        try {
            await deleteDoc(doc(db, "eventos", id));
        } catch (error) {
            alert("Erro: " + error.message);
        }
    }
}