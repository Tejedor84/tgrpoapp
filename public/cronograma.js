import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, onSnapshot, query, orderBy, where, doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ELEMENTOS ---
const grid = document.getElementById('cronogramaGrid');
const modal = document.getElementById('modalTask');
const form = document.getElementById('formTask');
const userEmailSpan = document.getElementById('user-email');

// Filtros
const filterDate = document.getElementById('filterDate');
const filterText = document.getElementById('filterText');

// Botões
const btnAdd = document.getElementById('btnAdd');
const btnHistory = document.getElementById('btnHistory');
const btnCopy = document.getElementById('btnCopy');
const btnCancel = document.getElementById('btnCancel');
const closeModal = document.getElementById('closeModal');

// Campos do Form
const inpDate = document.getElementById('inpDate');
const inpTime = document.getElementById('inpTime');
const chkNoTime = document.getElementById('chkNoTime'); 

// Variáveis de Estado
let tarefas = []; 
let modoHistorico = false;
let unsubscribe = null;

// --- 1. INICIALIZAÇÃO ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        userEmailSpan.textContent = user.email;
        iniciarListener(); 
    } else {
        window.location.href = "index.html";
    }
});

// --- 2. LISTENER (Checkbox Hora) ---
chkNoTime.addEventListener('change', () => {
    if (chkNoTime.checked) {
        inpTime.value = ""; 
        inpTime.disabled = true; 
        inpTime.required = false; 
    } else {
        inpTime.disabled = false;
    }
});

// --- 3. LISTENER DO FIREBASE ---
function iniciarListener() {
    if(unsubscribe) unsubscribe(); 

    const hoje = new Date().toISOString().split('T')[0];
    let q;

    if (modoHistorico) {
        q = query(collection(db, "cronograma"), where("data", "<", hoje), orderBy("data", "desc"));
        btnHistory.textContent = "Voltar para Hoje";
        btnHistory.classList.add("active-history");
    } else {
        q = query(collection(db, "cronograma"), where("data", ">=", hoje), orderBy("data", "asc"));
        btnHistory.textContent = "📜 Histórico";
        btnHistory.classList.remove("active-history");
    }

    unsubscribe = onSnapshot(q, (snapshot) => {
        tarefas = [];
        snapshot.forEach(doc => {
            tarefas.push({ id: doc.id, ...doc.data() });
        });
        
        // Ordenação Secundária (Hora)
        tarefas.sort((a, b) => {
            if (a.data === b.data) {
                if (a.hora === "A definir") return 1;
                if (b.hora === "A definir") return -1;
                return (a.hora || "").localeCompare(b.hora || "");
            }
            return 0;
        });

        renderizar();
    }, (error) => {
        console.error("Erro:", error);
        grid.innerHTML = `<p class="loading-msg" style="color:#ff4d4d">Erro: ${error.message}</p>`;
    });
}

// --- 4. RENDERIZAÇÃO ---
function renderizar() {
    grid.innerHTML = "";

    const termo = filterText.value.toLowerCase();
    const dataFiltro = filterDate.value;

    const filtrados = tarefas.filter(t => {
        const matchTexto = 
            t.titulo.toLowerCase().includes(termo) || 
            (t.local && t.local.toLowerCase().includes(termo)) ||
            (t.equipe && t.equipe.toLowerCase().includes(termo));
        
        let matchData = true;
        if (dataFiltro) matchData = (t.data === dataFiltro);

        return matchTexto && matchData;
    });

    if (filtrados.length === 0) {
        grid.innerHTML = `<p class="loading-msg">Nenhuma atividade encontrada.</p>`;
        return;
    }

    filtrados.forEach(t => {
        const card = document.createElement('div');
        const classeExtra = t.pendencias ? 'has-pending' : '';
        card.className = `task-card ${classeExtra}`;

        const dataFormatada = t.data ? "📅 " + t.data.split('-').reverse().join('/') : "📅 Data Inválida";
        
        let displayHora = "";
        if (t.hora === "A definir") {
            displayHora = `<span style="color:#FFD700; font-weight:bold;">⚠️ A Definir</span>`;
        } else if (t.hora) {
            displayHora = `⏰ ${t.hora}`;
        }

        let equipeVisual = "";
        if (t.equipe) {
            equipeVisual = t.equipe.replace(/\n/g, "<br>");
        }

        card.innerHTML = `
            <div class="card-header">
                <span>${dataFormatada}</span>
                <span class="card-time" style="background:transparent; padding:0;">${displayHora}</span>
            </div>
            
            <div class="card-title">${t.titulo}</div>
            
            <div class="card-details">
                ${t.local ? `<p>📍 ${t.local}</p>` : ''}
                ${t.equipe ? `<p>👥 ${equipeVisual}</p>` : ''}
                ${t.detalhes ? `<p>📝 ${t.detalhes}</p>` : ''}
                ${t.pendencias ? `<p class="pending-alert">⚠️ ${t.pendencias}</p>` : ''}
            </div>

            <div class="card-actions">
                <button class="btn-icon" onclick="editarTarefa('${t.id}')" title="Editar">✏️</button>
                <button class="btn-icon" onclick="excluirTarefa('${t.id}')" title="Excluir" style="color:#ff4d4d;">🗑️</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

filterText.addEventListener('input', renderizar);
filterDate.addEventListener('input', renderizar);

// --- 5. CRUD ---
btnAdd.addEventListener('click', () => {
    form.reset();
    document.getElementById('taskId').value = "";
    chkNoTime.checked = false;
    inpTime.disabled = false;
    if(filterDate.value) inpDate.value = filterDate.value;
    else inpDate.valueAsDate = new Date();
    
    // Limpa chat para nova tarefa
    carregarComentarios(null);
    
    modal.classList.remove('hidden');
});

const fechar = () => modal.classList.add('hidden');
closeModal.addEventListener('click', fechar);
btnCancel.addEventListener('click', fechar);

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('taskId').value;
    let horaFinal = chkNoTime.checked ? "A definir" : inpTime.value;

    const dados = {
        data: inpDate.value,
        hora: horaFinal,
        titulo: document.getElementById('inpTitle').value,
        local: document.getElementById('inpLocal').value,
        equipe: document.getElementById('inpTeam').value, 
        pendencias: document.getElementById('inpPending').value,
        detalhes: document.getElementById('inpDetails').value
    };

    fechar();

    try {
        if (id) await updateDoc(doc(db, "cronograma", id), dados);
        else await addDoc(collection(db, "cronograma"), dados);
    } catch (error) {
        alert("Erro ao salvar: " + error.message);
    }
});

window.editarTarefa = (id) => {
    const t = tarefas.find(x => x.id === id);
    if (!t) return;

    document.getElementById('taskId').value = t.id;
    document.getElementById('inpDate').value = t.data;
    
    if (t.hora === "A definir") {
        chkNoTime.checked = true;
        inpTime.value = "";
        inpTime.disabled = true;
    } else {
        chkNoTime.checked = false;
        inpTime.value = t.hora;
        inpTime.disabled = false;
    }

    document.getElementById('inpTitle').value = t.titulo;
    document.getElementById('inpLocal').value = t.local;
    document.getElementById('inpTeam').value = t.equipe; 
    document.getElementById('inpPending').value = t.pendencias;
    document.getElementById('inpDetails').value = t.detalhes;

    // CARREGA COMENTÁRIOS DO EVENTO SELECIONADO (NOVO)
    carregarComentarios(t.id);

    modal.classList.remove('hidden');
};

window.excluirTarefa = async (id) => {
    if(confirm("Tem certeza que deseja excluir esta atividade?")) {
        try {
            await deleteDoc(doc(db, "cronograma", id));
        } catch (error) {
            alert("Erro ao excluir: " + error.message);
        }
    }
};

// --- EXTRAS ---
btnHistory.addEventListener('click', () => {
    modoHistorico = !modoHistorico;
    filterDate.value = "";
    filterText.value = "";
    iniciarListener();
});

btnCopy.addEventListener('click', () => {
    if (tarefas.length === 0) return alert("Nada para copiar.");
    const cards = document.querySelectorAll('.task-card');
    if (cards.length === 0) return alert("Nenhuma tarefa visível.");

    const gruposPorData = {};

    cards.forEach(card => {
        let dataTexto = card.querySelector('.card-header span:first-child').innerText.replace('📅', '').trim();
        let hora = card.querySelector('.card-time').innerText.replace('⏰', '').replace('⚠️', '').trim();
        let titulo = card.querySelector('.card-title').innerText.trim();
        let detalhesArr = [];
        
        card.querySelectorAll('.card-details p').forEach(p => {
            let rawHtml = p.innerHTML;
            let textWithNewlines = rawHtml.replace(/<br\s*[\/]?>/gi, "\n");
            let tempDiv = document.createElement("div");
            tempDiv.innerHTML = textWithNewlines;
            let cleanText = tempDiv.innerText;
            cleanText = cleanText.replace(/📍|👥|📝|⚠️/g, '').trim();

            const partes = cleanText.split(/[\n,]/g);
            partes.forEach(parte => {
                const limpo = parte.trim();
                if(limpo) detalhesArr.push(limpo);
            });
        });

        if (!gruposPorData[dataTexto]) gruposPorData[dataTexto] = [];

        gruposPorData[dataTexto].push({
            hora: hora,
            titulo: titulo,
            detalhes: detalhesArr
        });
    });

    let textoFinal = `*AGENDA LOGISTICA - TG LOG*\n\n`;

    for (const [data, listaItens] of Object.entries(gruposPorData)) {
        textoFinal += `*DATA: ${data}*\n`;
        textoFinal += `------------------------\n`;
        listaItens.forEach(item => {
            let linhaHora = item.hora ? `${item.hora} - ` : "";
            textoFinal += `*${linhaHora}${item.titulo}*\n`;
            item.detalhes.forEach(det => { textoFinal += `> ${det}\n`; });
            textoFinal += `\n`; 
        });
        textoFinal += `\n`;
    }

    navigator.clipboard.writeText(textoFinal).then(() => {
        alert("Copiado com sucesso!");
    }).catch(err => {
        alert("Erro ao copiar.");
    });
});

/* =========================================================
   MÓDULO DE COMENTÁRIOS (NOVO - ADICIONADO AO FINAL)
   ========================================================= */

let eventoAtualId = null;
let unsubscribeComments = null; // Para parar de ouvir quando fechar modal

function carregarComentarios(eventoId) {
    eventoAtualId = eventoId;
    const listaDiv = document.getElementById('lista-comentarios');
    const inputArea = document.querySelector('.comentarios-input-area');
    
    // Limpa listener anterior se existir
    if (unsubscribeComments) unsubscribeComments();

    if (!eventoId) {
        listaDiv.innerHTML = '<div class="empty-state">Salve a atividade para habilitar os comentários.</div>';
        inputArea.style.display = 'none';
        return;
    }

    // Mostra input e loading
    inputArea.style.display = 'flex';
    listaDiv.innerHTML = '<div class="empty-state">Carregando conversas...</div>';

    // Ouve em tempo real
    const q = query(
        collection(db, "cronograma", eventoId, "comentarios"),
        orderBy("data", "asc")
    );

    unsubscribeComments = onSnapshot(q, (snapshot) => {
        listaDiv.innerHTML = '';
        
        if (snapshot.empty) {
            listaDiv.innerHTML = '<div class="empty-state">Nenhum comentário ainda.</div>';
            return;
        }

        snapshot.forEach(doc => {
            renderizarComentario(doc.data());
        });
        
        // Rola para o final
        listaDiv.scrollTop = listaDiv.scrollHeight;
    });
}

function renderizarComentario(data) {
    const listaDiv = document.getElementById('lista-comentarios');
    
    // Formata a data
    let dataFormatada = 'Agora';
    if (data.data) {
        const dateObj = data.data.toDate();
        dataFormatada = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + 
                        ' ' + 
                        dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    const div = document.createElement('div');
    div.className = 'comentario-item';
    div.innerHTML = `
        <div class="comentario-header">
            <span class="comentario-autor">${data.autor || 'Usuário'}</span>
            <span style="font-size:10px;">${dataFormatada}</span>
        </div>
        <div class="comentario-texto">${data.texto}</div>
    `;
    
    listaDiv.appendChild(div);
}

// Torna global para usar no HTML
window.enviarComentario = function() {
    const input = document.getElementById('novo-comentario');
    const texto = input.value.trim();
    
    if (!texto) return;
    if (!eventoAtualId) return alert("Erro: ID do evento não encontrado.");

    const user = auth.currentUser;
    const autorEmail = user ? user.email.split('@')[0] : 'Anônimo'; // Pega parte antes do @

    addDoc(collection(db, "cronograma", eventoAtualId, "comentarios"), {
        texto: texto,
        autor: autorEmail,
        data: serverTimestamp()
    }).then(() => {
        input.value = ''; // Limpa campo
    }).catch(err => {
        console.error("Erro ao comentar:", err);
        alert("Erro ao enviar mensagem.");
    });
};

// Permite enviar com ENTER
document.getElementById('novo-comentario').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        window.enviarComentario();
    }
});