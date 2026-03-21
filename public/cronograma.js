import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, onSnapshot, query, orderBy, where, doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ELEMENTOS DOM ---
const grid = document.getElementById('cronogramaGrid');
const modal = document.getElementById('modalTask');
const form = document.getElementById('formTask');
const filterDate = document.getElementById('filterDate');
const filterText = document.getElementById('filterText');
const chkNoTime = document.getElementById('chkNoTime');
const inpTime = document.getElementById('inpTime');
const selectLocal = document.getElementById('inpLocal');

// --- ESTADO ---
let tarefas = [];
let modoHistorico = false;
let eventoAtualId = null;
let unsubCronograma = null;
let unsubComentarios = null;

// --- INICIALIZAÇÃO ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Fallback de segurança: suporta tanto a navbar antiga quanto a nova sem quebrar o código
        const userSpan = document.getElementById('userEmail') || document.getElementById('user-email');
        if (userSpan) userSpan.textContent = user.email;
        
        carregarLocais();
        iniciarListenerCronograma(); // Carrega tudo sem forçar filtro na data atual
    } else {
        window.location.href = "index.html";
    }
});

// --- LOCAIS (DROPDOWN) ---
function carregarLocais() {
    onSnapshot(query(collection(db, "locais"), orderBy("nome")), (snapshot) => {
        selectLocal.innerHTML = '<option value="">Selecione um local...</option>';
        snapshot.forEach(doc => {
            const opt = document.createElement('option');
            opt.value = doc.data().nome;
            opt.textContent = doc.data().nome;
            selectLocal.appendChild(opt);
        });
    });
}

// --- CONTROLE DE TEMPO (A DEFINIR) ---
chkNoTime.addEventListener('change', (e) => {
    inpTime.value = "";
    inpTime.disabled = e.target.checked;
});

// --- LISTENERS DE DADOS ---
function definirDataHoje() {
    const hoje = new Date().toISOString().split('T')[0];
    filterDate.value = hoje;
}

function iniciarListenerCronograma() {
    if (unsubCronograma) unsubCronograma();

    const hoje = new Date().toISOString().split('T')[0];
    let q = modoHistorico 
        ? query(collection(db, "cronograma"), where("data", "<", hoje), orderBy("data", "desc"))
        : query(collection(db, "cronograma"), where("data", ">=", hoje), orderBy("data", "asc"));

    const btnHistory = document.getElementById('btnHistory');
    if(btnHistory) btnHistory.style.backgroundColor = modoHistorico ? "#555" : "";

    unsubCronograma = onSnapshot(q, (snapshot) => {
        tarefas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tarefas.sort((a, b) => {
            if (a.data === b.data) {
                if (a.hora === "A definir") return 1;
                if (b.hora === "A definir") return -1;
                return (a.hora || "").localeCompare(b.hora || "");
            }
            return 0;
        });
        renderizar();
    });
}

// --- RENDERIZAÇÃO ---
function renderizar() {
    grid.innerHTML = "";
    const termo = filterText.value.toLowerCase();
    const dataF = filterDate.value;

    const filtrados = tarefas.filter(t => {
        const txt = `${t.titulo || ""} ${t.local || ""} ${t.equipe || ""}`.toLowerCase();
        const matchData = dataF ? t.data === dataF : true;
        return txt.includes(termo) && matchData;
    });

    if (!filtrados.length) {
        grid.innerHTML = `<p class="loading-msg">Nenhuma atividade localizada.</p>`;
        return;
    }

    // 1. Agrupamento em tempo de execução
    const gruposPorData = {};
    filtrados.forEach(t => {
        const dataStr = t.data ? t.data.split('-').reverse().join('/') : "Data Inválida";
        if (!gruposPorData[dataStr]) gruposPorData[dataStr] = [];
        gruposPorData[dataStr].push(t);
    });

    // 2. Renderização por blocos
    for (const [data, itens] of Object.entries(gruposPorData)) {
        
        // Injeção do Divisor Visual de Data
        const divisor = document.createElement('div');
        divisor.style.gridColumn = "1 / -1";
        divisor.style.borderBottom = "1px solid #333";
        divisor.style.marginTop = "20px";
        divisor.style.paddingBottom = "5px";
        divisor.innerHTML = `<h3 style="color: #FFD700; margin: 0; font-size: 1.2em;"><i class="fas fa-calendar-day"></i> ${data}</h3>`;
        grid.appendChild(divisor);

        // Injeção dos Cartões
        itens.forEach(t => {
            const card = document.createElement('div');
            card.className = `task-card ${t.pendencias ? 'has-pending' : ''}`;
            
            const exibeHora = t.hora === "A definir" ? "⚠️ A Definir" : `⏰ ${t.hora || ""}`;
            const equipeBr = (t.equipe || "").replace(/\n/g, "<br>");
            const obsBr = (t.detalhes || "").replace(/\n/g, "<br>");

            card.innerHTML = `
                <div class="card-header">
                    <span>📅 ${data}</span>
                    <span class="card-time">${exibeHora}</span>
                </div>
                <div class="card-title">${t.titulo || "Sem título"}</div>
                <div class="card-details">
                    ${t.local ? `<p>📍 ${t.local}</p>` : ''}
                    ${t.equipe ? `<p>👥<br>${equipeBr}</p>` : ''}
                    ${t.detalhes ? `<p>📝<br>${obsBr}</p>` : ''}
                    ${t.pendencias ? `<p class="pending-alert">⚠️ ${t.pendencias}</p>` : ''}
                </div>
                <div class="card-actions">
                    <button type="button" class="btn-icon btn-dup" data-id="${t.id}" title="Duplicar">📑</button>
                    <button type="button" class="btn-icon btn-edit" data-id="${t.id}" title="Editar">✏️</button>
                    <button type="button" class="btn-icon btn-del" data-id="${t.id}" title="Excluir" style="color:#ff4d4d;">🗑️</button>
                </div>
            `;
            grid.appendChild(card);
        });
    }
}




// --- FILTROS RÁPIDOS ---
const btnToday = document.getElementById('btnToday');
if(btnToday) {
    btnToday.addEventListener('click', () => {
        modoHistorico = false;
        definirDataHoje();
        iniciarListenerCronograma();
    });
}

const btnHistory = document.getElementById('btnHistory');
if(btnHistory) {
    btnHistory.addEventListener('click', () => {
        modoHistorico = true;
        filterDate.value = "";
        iniciarListenerCronograma();
    });
}

// --- GESTÃO DO MODAL E FORMULÁRIO ---
const fecharModal = () => {
    modal.classList.add('hidden');
    form.reset();
    document.getElementById('taskId').value = "";
    inpTime.disabled = false;
    eventoAtualId = null;
    if(unsubComentarios) unsubComentarios();
};

document.getElementById('btnAdd').addEventListener('click', () => {
    fecharModal();
    document.getElementById('inpDate').value = filterDate.value || new Date().toISOString().split('T')[0];
    document.getElementById('lista-comentarios').innerHTML = '<div class="empty-state">Salve para comentar.</div>';
    document.querySelector('.comentarios-input-area').style.display = 'none';
    modal.classList.remove('hidden');
});

document.getElementById('closeModal').addEventListener('click', fecharModal);
document.getElementById('btnCancel').addEventListener('click', fecharModal);

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('taskId').value;
    
    const payload = {
        data: document.getElementById('inpDate').value,
        hora: chkNoTime.checked ? "A definir" : inpTime.value,
        titulo: document.getElementById('inpTitle').value,
        local: selectLocal.value,
        equipe: document.getElementById('inpTeam').value,
        pendencias: document.getElementById('inpPending').value,
        detalhes: document.getElementById('inpDetails').value
    };

    fecharModal();

    try {
        if (id) await updateDoc(doc(db, "cronograma", id), payload);
        else await addDoc(collection(db, "cronograma"), payload);
    } catch (err) {
        alert("Erro ao salvar: " + err.message);
    }
});

// --- DELEGAÇÃO DE EVENTOS (LÁPIS, LIXEIRA E DUPLICAR) ---
grid.addEventListener('click', async (e) => {
    const btnEdit = e.target.closest('.btn-edit');
    const btnDel = e.target.closest('.btn-del');
    const btnDup = e.target.closest('.btn-dup'); 
    
    // AÇÃO: DUPLICAR TAREFA
    if (btnDup) {
        const t = tarefas.find(x => x.id === btnDup.dataset.id);
        if (!t) return;

        fecharModal();

        document.getElementById('taskId').value = ""; 
        document.getElementById('inpDate').value = t.data || "";

        if (t.hora === "A definir") {
            chkNoTime.checked = true;
            inpTime.value = "";
            inpTime.disabled = true;
        } else {
            chkNoTime.checked = false;
            inpTime.value = t.hora || "";
            inpTime.disabled = false;
        }

        document.getElementById('inpTitle').value = `${t.titulo} (Cópia)` || ""; 
        selectLocal.value = t.local || "";
        document.getElementById('inpTeam').value = t.equipe || "";
        document.getElementById('inpPending').value = t.pendencias || "";
        document.getElementById('inpDetails').value = t.detalhes || "";

        document.getElementById('lista-comentarios').innerHTML = '<div class="empty-state">Salve a atividade para habilitar comentários.</div>';
        document.querySelector('.comentarios-input-area').style.display = 'none';

        modal.classList.remove('hidden');
    }

    // AÇÃO: EDITAR
    if (btnEdit) {
        const t = tarefas.find(x => x.id === btnEdit.dataset.id);
        if (!t) return;

        fecharModal(); 
        
        document.getElementById('taskId').value = t.id;
        document.getElementById('inpDate').value = t.data || "";
        
        if (t.hora === "A definir") {
            chkNoTime.checked = true;
            inpTime.value = "";
            inpTime.disabled = true;
        } else {
            chkNoTime.checked = false;
            inpTime.value = t.hora || "";
            inpTime.disabled = false;
        }

        document.getElementById('inpTitle').value = t.titulo || "";
        selectLocal.value = t.local || "";
        document.getElementById('inpTeam').value = t.equipe || "";
        document.getElementById('inpPending').value = t.pendencias || "";
        document.getElementById('inpDetails').value = t.detalhes || "";

        iniciarComentarios(t.id);
        modal.classList.remove('hidden');
    }

    // AÇÃO: DELETAR
    if (btnDel && confirm("Excluir atividade?")) {
        await deleteDoc(doc(db, "cronograma", btnDel.dataset.id));
    }
}); 

// --- COPIAR PARA WHATSAPP ---
document.getElementById('btnCopy').addEventListener('click', () => {
    const cards = document.querySelectorAll('.task-card');
    if (!cards.length) return alert("Nada para copiar.");

    let texto = `*AGENDA LOGÍSTICA - TG LOG*\n\n`;
    
    cards.forEach(c => {
        const data = c.querySelector('.card-header span:first-child').innerText.replace('📅', '').trim();
        const hora = c.querySelector('.card-time').innerText.replace('⏰', '').replace('⚠️', '').trim();
        const titulo = c.querySelector('.card-title').innerText.trim();
        
        texto += `*DATA: ${data}*\n`;
        texto += `*${hora ? hora + ' - ' : ''}${titulo}*\n`;
        
        c.querySelectorAll('.card-details p').forEach(p => {
            const raw = p.innerText.replace(/📍|👥|📝|⚠️/g, '').trim();
            if (raw) texto += `> ${raw.replace(/\n/g, '\n> ')}\n`;
        });
        texto += `\n`;
    });

    navigator.clipboard.writeText(texto).then(() => alert("Copiado!")).catch(()=>alert("Erro."));
});

// --- MÓDULO DE COMENTÁRIOS ---
function iniciarComentarios(id) {
    eventoAtualId = id;
    const lista = document.getElementById('lista-comentarios');
    document.querySelector('.comentarios-input-area').style.display = 'flex';
    lista.innerHTML = 'Carregando...';

    const q = query(collection(db, "cronograma", id, "comentarios"), orderBy("data", "asc"));
    unsubComentarios = onSnapshot(q, (snap) => {
        lista.innerHTML = '';
        if (snap.empty) {
            lista.innerHTML = '<div class="empty-state">Nenhum comentário.</div>';
            return;
        }
        snap.forEach(doc => {
            const d = doc.data();
            const dateStr = d.data ? d.data.toDate().toLocaleString('pt-BR') : 'Agora';
            lista.innerHTML += `
                <div class="comentario-item">
                    <div class="comentario-header"><b>${d.autor}</b> <small>${dateStr}</small></div>
                    <div class="comentario-texto">${d.texto}</div>
                </div>`;
        });
        lista.scrollTop = lista.scrollHeight;
    });
}

document.getElementById('btnSendComment').addEventListener('click', enviarComentario);
document.getElementById('novo-comentario').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') enviarComentario();
});

async function enviarComentario() {
    const inp = document.getElementById('novo-comentario');
    if (!inp.value.trim() || !eventoAtualId) return;

    const autor = auth.currentUser ? auth.currentUser.email.split('@')[0] : 'User';
    await addDoc(collection(db, "cronograma", eventoAtualId, "comentarios"), {
        texto: inp.value.trim(),
        autor: autor,
        data: serverTimestamp()
    });
    inp.value = '';
}