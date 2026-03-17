/* =================================================================
   CRONOGRAMA.JS - VERSÃO COM DUPLICAÇÃO DE TAREFAS
   ================================================================= */

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
const DIAS_SEMANA = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function formatarDiaCabecalho(dataISO) {
    const [y, m, d] = dataISO.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const diaSemana = DIAS_SEMANA[dt.getDay()];
    return `${diaSemana}, ${String(d).padStart(2,'0')} de ${MESES[m-1]}`;
}

function isHoje(dataISO) {
    const hoje = new Date();
    const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
    return dataISO === hojeISO;
}

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

    // Agrupa por data
    const porDia = {};
    filtrados.forEach(t => {
        const chave = t.data || 'sem-data';
        if (!porDia[chave]) porDia[chave] = [];
        porDia[chave].push(t);
    });

    // Ordena dias e cards dentro de cada dia por hora
    const diasOrdenados = Object.keys(porDia).sort();
    diasOrdenados.forEach(dia => {
        porDia[dia].sort((a, b) => {
            if (!a.hora || a.hora === 'A definir') return 1;
            if (!b.hora || b.hora === 'A definir') return -1;
            return a.hora.localeCompare(b.hora);
        });
    });

    diasOrdenados.forEach(dia => {
        const tarefasDoDia = porDia[dia];
        const hoje = isHoje(dia);

        // Cabeçalho do dia
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-group-header' + (hoje ? ' day-today' : '');
        const labelDia = dia !== 'sem-data' ? formatarDiaCabecalho(dia) : 'Data não definida';
        dayHeader.innerHTML = `
            <div class="day-label">
                <span class="day-name">${labelDia}</span>
                ${hoje ? '<span class="today-badge">HOJE</span>' : ''}
            </div>
            <span class="day-count">${tarefasDoDia.length} atividade${tarefasDoDia.length > 1 ? 's' : ''}</span>`;
        grid.appendChild(dayHeader);

        // Grid de cards do dia
        const dayGrid = document.createElement('div');
        dayGrid.className = 'day-cards-grid';
        grid.appendChild(dayGrid);

        tarefasDoDia.forEach(t => {
            const card = document.createElement('div');
            const classeExtra = t.pendencias ? 'has-pending' : '';
            card.className = `task-card ${classeExtra}`;

            let displayHora = "";
            if (t.hora === "A definir") {
                displayHora = `<span class="hora-pill hora-indefinida">⚠️ A Definir</span>`;
            } else if (t.hora) {
                displayHora = `<span class="hora-pill">⏰ ${t.hora}</span>`;
            }

            let equipeVisual = "";
            if (t.equipe) {
                equipeVisual = t.equipe.split('\n')
                    .map(n => n.trim()).filter(Boolean)
                    .map(n => `<span class="equipe-nome">| ${n}</span>`)
                    .join('');
            }

            card.innerHTML = `
                <div class="card-top">
                    <div class="card-hora">${displayHora}</div>
                    <div class="card-actions">
                        <button class="btn-icon" onclick="editarTarefa('${t.id}')" title="Editar">✏️</button>
                        <button class="btn-icon" onclick="duplicarTarefa('${t.id}')" title="Duplicar">📄</button>
                        <button class="btn-icon" onclick="excluirTarefa('${t.id}')" title="Excluir" style="color:#ff4d4d;">🗑️</button>
                    </div>
                </div>

                <div class="card-title">${t.titulo}</div>

                <div class="card-details">
                    ${t.local    ? `<div class="detail-row"><span class="detail-icon">📍</span><span>${t.local}</span></div>` : ''}
                    ${t.equipe   ? `<div class="detail-row detail-equipe"><span class="detail-icon">👥</span><div class="equipe-lista">${equipeVisual}</div></div>` : ''}
                    ${t.detalhes ? `<div class="detail-row"><span class="detail-icon">📝</span><span>${t.detalhes}</span></div>` : ''}
                    ${t.pendencias ? `<div class="detail-row pending-alert"><span>⚠️</span><span>${t.pendencias}</span></div>` : ''}
                </div>`;

            dayGrid.appendChild(card);
        });
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
    
    carregarComentarios(null);
    modal.classList.remove('hidden');
});

const fechar = () => {
    modal.classList.add('hidden');
    form.reset(); // Força a limpeza das validações HTML 5 do navegador
    document.getElementById('taskId').value = ""; // Limpa a referência de edição
    chkNoTime.checked = false; // Restaura o checkbox
    inpTime.disabled = false; // Destrava o campo de hora
}

closeModal.addEventListener('click' , fechar);
btnCancel.addEventListener('click' , fechar);

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

// EDIÇÃO

window.editarTarefa = (id) => {
    const t = tarefas.find(x => x.id === id);
    if (!t) return;

    form.reset(); // Limpeza preventiva antes de popular novos dados

    document.getElementById('taskId').value = t.id;
    document.getElementById('inpDate').value = t.data;

    // Carrega histórico de chat
    carregarComentarios(t.id);
    modal.style.display = 'flex';
};

// --- NOVA FUNÇÃO: DUPLICAR TAREFA ---
window.duplicarTarefa = (id) => {
    const t = tarefas.find(x => x.id === id);
    if (!t) return;

    // 1. Limpa o ID para garantir que salve como NOVO
    document.getElementById('taskId').value = ""; 
    
    // 2. Preenche os dados iguais ao original
    preencherFormulario(t);

    // 3. NÃO carrega comentários (começa do zero)
    carregarComentarios(null);

    // 4. Abre o modal e foca na DATA para a pessoa mudar
    modal.style.display = 'flex';
    
    // Pequeno aviso visual ou foco
    const dataInput = document.getElementById('inpDate');
    dataInput.focus();
    // Opcional: dataInput.showPicker(); // Se o navegador suportar, abre o calendário direto
};

// Função auxiliar para não repetir código
function preencherFormulario(t) {
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
}

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
    // Lê direto do array de dados filtrados (não depende de seletores DOM)
    const termo = filterText.value.toLowerCase();
    const dataFiltro = filterDate.value;

    const filtrados = tarefas.filter(t => {
        const matchTexto =
            t.titulo.toLowerCase().includes(termo) ||
            (t.local  && t.local.toLowerCase().includes(termo)) ||
            (t.equipe && t.equipe.toLowerCase().includes(termo));
        const matchData = !dataFiltro || t.data === dataFiltro;
        return matchTexto && matchData;
    });

    if (filtrados.length === 0) return alert("Nada para copiar.");

    // Agrupa por data (mesmo critério da renderização)
    const porDia = {};
    filtrados.forEach(t => {
        const chave = t.data || 'sem-data';
        if (!porDia[chave]) porDia[chave] = [];
        porDia[chave].push(t);
    });

    // Ordena dias e por hora dentro de cada dia
    const diasOrdenados = Object.keys(porDia).sort();
    diasOrdenados.forEach(dia => {
        porDia[dia].sort((a, b) => {
            if (!a.hora || a.hora === 'A definir') return 1;
            if (!b.hora || b.hora === 'A definir') return -1;
            return a.hora.localeCompare(b.hora);
        });
    });

    let textoFinal = `*AGENDA LOGISTICA - TG LOG*\n\n`;

    diasOrdenados.forEach(dia => {
        const labelDia = dia !== 'sem-data'
            ? dia.split('-').reverse().join('/')
            : 'Data não definida';

        textoFinal += `*${labelDia}*\n`;
        textoFinal += `------------------------\n`;

        porDia[dia].forEach(t => {
            const hora = (!t.hora || t.hora === 'A definir') ? 'A definir' : t.hora;
            textoFinal += `*${hora} - ${t.titulo}*\n`;

            if (t.local)    textoFinal += `*Local: ${t.local}*\n`;

            if (t.equipe) {
                t.equipe.split('\n').map(n => n.trim()).filter(Boolean)
                    .forEach(nome => { textoFinal += `| ${nome}\n`; });
            }

            if (t.detalhes)   textoFinal += `*${t.detalhes}*\n`;
            if (t.pendencias) textoFinal += `*⚠️ ${t.pendencias}*\n`;

            textoFinal += `\n`;
        });

        textoFinal += `\n`;
    });

    navigator.clipboard.writeText(textoFinal).then(() => {
        alert("Copiado com sucesso!");
    }).catch(() => {
        alert("Erro ao copiar. Verifique as permissões do navegador.");
    });
});

/* =========================================================
   MÓDULO DE COMENTÁRIOS
   ========================================================= */

let eventoAtualId = null;
let unsubscribeComments = null; 

function carregarComentarios(eventoId) {
    eventoAtualId = eventoId;
    const listaDiv = document.getElementById('lista-comentarios');
    const inputArea = document.querySelector('.comentarios-input-area');
    
    if (unsubscribeComments) unsubscribeComments();

    if (!eventoId) {
        listaDiv.innerHTML = '<div class="empty-state">Salve a atividade para habilitar os comentários.</div>';
        inputArea.style.display = 'none';
        return;
    }

    inputArea.style.display = 'flex';
    listaDiv.innerHTML = '<div class="empty-state">Carregando conversas...</div>';

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
        
        listaDiv.scrollTop = listaDiv.scrollHeight;
    });
}

function renderizarComentario(data) {
    const listaDiv = document.getElementById('lista-comentarios');
    
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

window.enviarComentario = function() {
    const input = document.getElementById('novo-comentario');
    const texto = input.value.trim();
    
    if (!texto) return;
    if (!eventoAtualId) return alert("Erro: ID do evento não encontrado.");

    const user = auth.currentUser;
    const autorEmail = user ? user.email.split('@')[0] : 'Anônimo'; 

    addDoc(collection(db, "cronograma", eventoAtualId, "comentarios"), {
        texto: texto,
        autor: autorEmail,
        data: serverTimestamp()
    }).then(() => {
        input.value = ''; 
    }).catch(err => {
        console.error("Erro ao comentar:", err);
        alert("Erro ao enviar mensagem.");
    });
};

document.getElementById('novo-comentario').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        window.enviarComentario();
    }
});