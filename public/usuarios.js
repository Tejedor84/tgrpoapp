import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const tableBody = document.getElementById('usersTableBody');
const modal = document.getElementById('modalUser');
const form = document.getElementById('formUser');
const userIdField = document.getElementById('userId');
const inpName = document.getElementById('inpName');
const inpEmail = document.getElementById('inpEmail');
const inpPhone = document.getElementById('inpPhone'); // Novo Campo

const btnNewUser = document.getElementById('btnNewUser');
const btnCancel = document.getElementById('btnCancel');
const closeModal = document.getElementById('closeModal');

const modulosKeys = [
    'dashboard', 'cronograma', 'eventos', 'locais', 'equipamentos',
    'ponto', 'equipe', 'relatorio_ponto', 'clientes', 'orcamentos',
    'crm', 'pagamentos', 'pendencias'
];

onAuthStateChanged(auth, (user) => {
    if (user) {
        carregarUsuarios();
    } else {
        window.location.href = "index.html";
    }
});

// LISTAR
async function carregarUsuarios() {
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Carregando...</td></tr>';
    try {
        const q = query(collection(db, "usuarios_permissoes"), orderBy("email"));
        const snapshot = await getDocs(q);
        
        tableBody.innerHTML = "";
        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhum usuário.</td></tr>';
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const tr = document.createElement('tr');
            
            let nivelHtml = data.admin ? `<span class="badge-admin">ADMIN</span>` : `<span class="badge-user">Colaborador</span>`;

            let resumoPermissoes = "";
            if (data.admin) {
                resumoPermissoes = "<em>Acesso Total</em>";
            } else if (data.permissoes) {
                if (Array.isArray(data.permissoes)) {
                    resumoPermissoes = `<span style="font-size:0.85em; color:#aaa;">${data.permissoes.length} acessos (Legado)</span>`;
                } else {
                    let totalEdit = 0;
                    let totalRead = 0;
                    Object.values(data.permissoes).forEach(v => {
                        if(v === 'editor') totalEdit++;
                        if(v === 'leitor') totalRead++;
                    });
                    
                    if (totalEdit === 0 && totalRead === 0) resumoPermissoes = "<span class='tag-block'>Bloqueado</span>";
                    else resumoPermissoes = `<span class="tag-editor">${totalEdit} Edit</span> • <span class="tag-leitor">${totalRead} Ler</span>`;
                }
            } else {
                resumoPermissoes = "<span class='tag-block'>Sem acesso</span>";
            }

            const nomeDisplay = data.nome || "---";

            tr.innerHTML = `
                <td style="color:#FFD700; font-weight:500;">${nomeDisplay}</td>
                <td>${data.email}</td>
                <td>${nivelHtml}</td>
                <td>${resumoPermissoes}</td>
                <td>
                    <button class="btn-icon" onclick="abrirEdicao('${docSnap.id}')">✏️</button>
                    <button class="btn-icon" onclick="excluirUsuario('${docSnap.id}')" style="color:#ff4d4d;">🗑️</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

    } catch (error) {
        console.error(error);
        tableBody.innerHTML = '<tr><td colspan="5" style="color:red;">Erro ao carregar lista.</td></tr>';
    }
}

// NOVO
btnNewUser.addEventListener('click', () => {
    form.reset();
    userIdField.value = "";
    document.getElementById('modalTitle').textContent = "Novo Usuário";
    modulosKeys.forEach(k => document.getElementById(`perm_${k}`).value = "");
    modal.classList.remove('hidden');
});

// EDITAR
window.abrirEdicao = async (id) => {
    document.getElementById('modalTitle').textContent = "Carregando...";
    modal.classList.remove('hidden');
    form.reset();

    try {
        const docRef = doc(db, "usuarios_permissoes", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            userIdField.value = docSnap.id;
            inpEmail.value = data.email;
            inpName.value = data.nome || "";
            inpPhone.value = data.telefone || ""; // Carrega telefone
            
            document.getElementById('modalTitle').textContent = `Editar: ${data.email}`;
            document.getElementById('perm_admin').checked = !!data.admin;

            modulosKeys.forEach(k => document.getElementById(`perm_${k}`).value = "");

            if (data.permissoes) {
                if (Array.isArray(data.permissoes)) {
                    data.permissoes.forEach(mod => {
                        const el = document.getElementById(`perm_${mod}`);
                        if(el) el.value = "editor";
                    });
                } else {
                    for (const [mod, nivel] of Object.entries(data.permissoes)) {
                        const el = document.getElementById(`perm_${mod}`);
                        if(el) el.value = nivel;
                    }
                }
            }
        }
    } catch (error) {
        console.error(error);
        alert("Erro ao buscar dados.");
        modal.classList.add('hidden');
    }
};

// SALVAR
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = userIdField.value;
    const email = inpEmail.value.trim();
    const nome = inpName.value.trim();
    const telefone = inpPhone.value.trim(); // Pega valor
    const isAdmin = document.getElementById('perm_admin').checked;
    
    let permissoesObj = {};
    if (!isAdmin) {
        modulosKeys.forEach(key => {
            const selectEl = document.getElementById(`perm_${key}`);
            if (selectEl && selectEl.value !== "") {
                permissoesObj[key] = selectEl.value;
            }
        });
    }

    const dados = {
        email: email,
        nome: nome,
        telefone: telefone, // Salva
        admin: isAdmin,
        permissoes: permissoesObj
    };

    try {
        if (id) await updateDoc(doc(db, "usuarios_permissoes", id), dados);
        else await addDoc(collection(db, "usuarios_permissoes"), dados);
        
        modal.classList.add('hidden');
        carregarUsuarios();
    } catch (error) {
        alert("Erro: " + error.message);
    }
});

window.excluirUsuario = async (id) => {
    if(confirm("Remover permissões deste usuário?")) {
        await deleteDoc(doc(db, "usuarios_permissoes", id));
        carregarUsuarios();
    }
};

const fechar = () => modal.classList.add('hidden');
closeModal.addEventListener('click', fechar);
btnCancel.addEventListener('click', fechar);