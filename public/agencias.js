import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { verificarPermissao } from "./auth-guard.js";

// Elementos
const inpNomeAgencia = document.getElementById('inpNomeAgencia');
const inpEndereco = document.getElementById('inpEndereco');
const contactsList = document.getElementById('contactsList');
const btnSalvar = document.getElementById('btnSalvar');
const btnCancelar = document.getElementById('btnCancelar');
const editIdInput = document.getElementById('editId');
const tableBody = document.getElementById('tableBody');
const inpBusca = document.getElementById('inpBusca');

// --- 1. FUNÇÕES GLOBAIS ---
window.adicionarLinhaContato = (dados = {}) => {
    const div = document.createElement('div');
    div.className = 'contact-row';
    
    div.innerHTML = `
        <input type="text" class="inp-c-nome" placeholder="Nome do Produtor/Contato" value="${dados.nome || ''}">
        <input type="text" class="inp-c-tel" placeholder="Telefone / Whats" value="${dados.telefone || ''}">
        <input type="email" class="inp-c-email" placeholder="E-mail" value="${dados.email || ''}">
        <button class="btn-remove-contact" onclick="this.parentElement.remove()">x</button>
    `;
    contactsList.appendChild(div);
};

// --- 2. INICIALIZAÇÃO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('user-email').textContent = user.email;
        try { await verificarPermissao(db, user.email); } catch(e) {}
        
        carregarAgencias();
        if(contactsList.children.length === 0) window.adicionarLinhaContato();
    } else {
        window.location.href = "index.html";
    }
});

// --- 3. CRUD ---
async function carregarAgencias() {
    tableBody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
    try {
        const q = query(collection(db, "agencias"), orderBy("nome"));
        const snapshot = await getDocs(q);
        
        tableBody.innerHTML = "";
        
        snapshot.forEach(docSnap => {
            const agencia = docSnap.data();
            const id = docSnap.id;
            
            let contatosHtml = "";
            if (agencia.contatos && agencia.contatos.length > 0) {
                agencia.contatos.forEach(c => {
                    contatosHtml += `<span class="contact-badge"><b>${c.nome}</b>: ${c.telefone}</span>`;
                });
            } else {
                contatosHtml = "<span style='color:#999; font-size:11px;'>Sem contatos</span>";
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${agencia.nome}</strong></td>
                <td>${contatosHtml}</td>
                <td>${agencia.endereco || '-'}</td>
                <td>
                    <button class="btn-action btn-edit">✏️</button>
                    <button class="btn-action btn-delete">🗑️</button>
                </td>
            `;

            tr.querySelector('.btn-edit').onclick = () => editarAgencia(id, agencia);
            tr.querySelector('.btn-delete').onclick = () => excluirAgencia(id, agencia.nome);

            tableBody.appendChild(tr);
        });

    } catch (error) {
        console.error(error);
        tableBody.innerHTML = '<tr><td colspan="4">Erro ao carregar.</td></tr>';
    }
}

btnSalvar.onclick = async () => {
    const nome = inpNomeAgencia.value.trim();
    if (!nome) return alert("Digite o nome da agência!");

    const contatos = [];
    document.querySelectorAll('.contact-row').forEach(row => {
        const cNome = row.querySelector('.inp-c-nome').value.trim();
        const cTel = row.querySelector('.inp-c-tel').value.trim();
        const cEmail = row.querySelector('.inp-c-email').value.trim();
        if (cNome || cTel || cEmail) contatos.push({ nome: cNome, telefone: cTel, email: cEmail });
    });

    const dados = {
        nome,
        endereco: inpEndereco.value.trim(),
        contatos,
        dataAtualizacao: new Date().toISOString()
    };

    try {
        btnSalvar.disabled = true;
        btnSalvar.textContent = "Salvando...";

        if (editIdInput.value) {
            await updateDoc(doc(db, "agencias", editIdInput.value), dados);
            alert("Agência atualizada!");
        } else {
            await addDoc(collection(db, "agencias"), dados);
            alert("Agência cadastrada!");
        }

        limparFormulario();
        carregarAgencias();

    } catch (error) {
        console.error(error);
        alert("Erro ao salvar: " + error.message);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = "💾 Salvar Agência";
    }
};

window.editarAgencia = (id, data) => {
    editIdInput.value = id;
    inpNomeAgencia.value = data.nome;
    inpEndereco.value = data.endereco || "";
    
    contactsList.innerHTML = "";
    if (data.contatos && data.contatos.length > 0) {
        data.contatos.forEach(c => window.adicionarLinhaContato(c));
    } else {
        window.adicionarLinhaContato();
    }

    btnSalvar.textContent = "🔄 Atualizar Agência";
    btnCancelar.style.display = "inline-block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.excluirAgencia = async (id, nome) => {
    if (confirm(`Tem certeza que deseja excluir ${nome}?`)) {
        try {
            await deleteDoc(doc(db, "agencias", id));
            carregarAgencias();
        } catch (error) {
            alert("Erro ao excluir: " + error.message);
        }
    }
};

function limparFormulario() {
    editIdInput.value = "";
    inpNomeAgencia.value = "";
    inpEndereco.value = "";
    contactsList.innerHTML = "";
    window.adicionarLinhaContato();
    btnSalvar.textContent = "💾 Salvar Agência";
    btnCancelar.style.display = "none";
}

btnCancelar.onclick = limparFormulario;

inpBusca.addEventListener('input', () => {
    const termo = inpBusca.value.toLowerCase();
    const linhas = tableBody.querySelectorAll('tr');
    linhas.forEach(tr => {
        const texto = tr.textContent.toLowerCase();
        tr.style.display = texto.includes(termo) ? '' : 'none';
    });
});