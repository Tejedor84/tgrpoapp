import { auth, db } from "./firebase-init.js";
import { collection, addDoc, onSnapshot, query, orderBy, where, doc, updateDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const pontoBody = document.getElementById('pontoBody');
const filterUser = document.getElementById('filterUser');
const filterMonth = document.getElementById('filterMonth');
const modalPonto = document.getElementById('modalPonto');
const formPonto = document.getElementById('formPonto');
const inpUser = document.getElementById('inpUser');
const inpStatus = document.getElementById('inpStatus');
const timeFields = document.getElementById('timeFields');

let registros = [];
let colaboradores = [];

// Inicializar Filtro de Mês com o atual
const agora = new Date();
filterMonth.value = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

// --- CARREGAR COLABORADORES (DA COLEÇÃO EQUIPE) ---
async function carregarColaboradores() {
    try {
        // Tenta buscar na coleção "equipe" primeiro
        const q = query(collection(db, "equipe"), orderBy("nome"));
        const snap = await getDocs(q);
        
        colaboradores = [];
        filterUser.innerHTML = '<option value="">Todos os Colaboradores</option>';
        inpUser.innerHTML = '<option value="" disabled selected>Selecione...</option>';

        if (snap.empty) {
            console.warn("Nenhum colaborador encontrado na coleção 'equipe'. Tentando 'usuarios'...");
            // Fallback: Se não tiver ninguém em equipe, tenta em usuarios
            const qUsers = query(collection(db, "usuarios"), orderBy("nome"));
            const snapUsers = await getDocs(qUsers);
            snapUsers.forEach(processarDoc);
        } else {
            snap.forEach(processarDoc);
        }

    } catch (error) {
        console.error("Erro ao carregar colaboradores:", error);
    }
}

function processarDoc(doc) {
    const data = doc.data();
    // Garante que tenha nome e email (ou usa o ID se não tiver email)
    const user = { 
        id: doc.id, 
        nome: data.nome || "Sem Nome", 
        email: data.email || doc.id // Usa o ID como identificador se não tiver email
    };
    colaboradores.push(user);
    
    // Popula os selects
    const opt = `<option value="${user.email}">${user.nome}</option>`;
    filterUser.innerHTML += opt;
    inpUser.innerHTML += opt;
}

// Escuta mudanças no Status para esconder horários se for Folga/Feriado
inpStatus.addEventListener('change', () => {
    if (["Folga", "Descanso", "Feriado", "Falta", "Atestado"].includes(inpStatus.value)) {
        timeFields.style.display = "none";
    } else {
        timeFields.style.display = "flex";
    }
});

function iniciarListenerPonto() {
    const q = query(collection(db, "ponto"), orderBy("data", "desc"));

    onSnapshot(q, (snapshot) => {
        registros = [];
        snapshot.forEach(doc => {
            registros.push({ id: doc.id, ...doc.data() });
        });
        renderizarPonto();
    });
}

function renderizarPonto() {
    pontoBody.innerHTML = "";
    const selUser = filterUser.value;
    const selMonth = filterMonth.value; // Formato YYYY-MM

    const filtrados = registros.filter(r => {
        const matchUser = selUser === "" || r.usuarioEmail === selUser;
        const matchMonth = r.data && r.data.startsWith(selMonth);
        return matchUser && matchMonth;
    });

    if (filtrados.length === 0) {
        pontoBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px;">Nenhum registro encontrado neste período.</td></tr>`;
        return;
    }

    filtrados.forEach(r => {
        const tr = document.createElement('tr');
        
        // Formatar data para exibição
        const dataBR = r.data ? r.data.split('-').reverse().join('/') : "--/--/----";
        
        // Busca o nome do colaborador na lista carregada
        const colabEncontrado = colaboradores.find(c => c.email === r.usuarioEmail);
        const nomeColab = colabEncontrado ? colabEncontrado.nome : (r.usuarioEmail || "Desconhecido");

        tr.innerHTML = `
            <td>${dataBR}</td>
            <td>${nomeColab}</td>
            <td>${r.entrada || '--:--'}</td>
            <td>${r.saida || '--:--'}</td>
            <td><span class="badge-status ${r.status || 'Trabalho'}">${r.status || 'Trabalho'}</span></td>
            <td class="obs-cell" title="${r.observacoes || ''}">${r.observacoes || ''}</td>
            <td>
                <button class="btn-icon" onclick="editarPonto('${r.id}')" title="Editar">✏️</button>
                <button class="btn-icon" onclick="excluirPonto('${r.id}')" title="Excluir" style="color:#ff4d4d;">🗑️</button>
            </td>
        `;
        pontoBody.appendChild(tr);
    });
}

// CRUD
document.getElementById('btnManualLaunch').onclick = () => {
    formPonto.reset();
    document.getElementById('pontoId').value = "";
    timeFields.style.display = "flex";
    modalPonto.classList.remove('hidden');
};

document.getElementById('btnCancel').onclick = () => modalPonto.classList.add('hidden');

formPonto.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('pontoId').value;
    
    const dados = {
        usuarioEmail: document.getElementById('inpUser').value,
        data: document.getElementById('inpDate').value,
        status: document.getElementById('inpStatus').value,
        entrada: document.getElementById('inpEntry').value || "",
        saida: document.getElementById('inpExit').value || "", // Corrigido typo inpExit.
        observacoes: document.getElementById('inpObs').value,
        editadoPor: auth.currentUser ? auth.currentUser.email : "Admin",
        timestamp: new Date().toISOString()
    };

    try {
        if (id) {
            await updateDoc(doc(db, "ponto", id), dados);
        } else {
            await addDoc(collection(db, "ponto"), dados);
        }
        modalPonto.classList.add('hidden');
    } catch (error) {
        alert("Erro ao salvar: " + error.message);
    }
};

window.editarPonto = (id) => {
    const r = registros.find(x => x.id === id);
    if (!r) return;

    document.getElementById('pontoId').value = r.id;
    document.getElementById('inpUser').value = r.usuarioEmail;
    document.getElementById('inpDate').value = r.data;
    document.getElementById('inpStatus').value = r.status || "Trabalho";
    document.getElementById('inpEntry').value = r.entrada || "";
    document.getElementById('inpExit').value = r.saida || "";
    document.getElementById('inpObs').value = r.observacoes || "";

    inpStatus.dispatchEvent(new Event('change'));
    modalPonto.classList.remove('hidden');
};

window.excluirPonto = async (id) => {
    if (confirm("Deseja excluir este registro de ponto?")) {
        try {
            await deleteDoc(doc(db, "ponto", id));
        } catch (error) {
            alert("Erro ao excluir: " + error.message);
        }
    }
};

// Inicialização
auth.onAuthStateChanged(user => {
    if (user) {
        carregarColaboradores().then(() => {
            iniciarListenerPonto();
        });
    } else {
        window.location.href = "index.html";
    }
});

filterUser.onchange = renderizarPonto;
filterMonth.onchange = renderizarPonto;