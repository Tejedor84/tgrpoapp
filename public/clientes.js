import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { verificarPermissao } from "./auth-guard.js";

// Elementos DOM
const inpEmpresa = document.getElementById('inpEmpresa');
const inpEndereco = document.getElementById('inpEndereco');
const contactsList = document.getElementById('contactsList');
const btnSalvar = document.getElementById('btnSalvar');
const btnCancelar = document.getElementById('btnCancelar');
const editIdInput = document.getElementById('editId');
const tableBody = document.getElementById('tableBody');
const inpBusca = document.getElementById('inpBusca');

// --- 1. FUNÇÕES GLOBAIS (HTML onclick) ---
window.adicionarLinhaContato = (dados = {}) => {
    const div = document.createElement('div');
    div.className = 'contact-row';
    
    div.innerHTML = `
        <input type="text" class="inp-c-nome" placeholder="Nome do Contato" value="${dados.nome || ''}">
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
        
        carregarClientes();
        // Adiciona uma linha vazia de contato ao iniciar
        if(contactsList.children.length === 0) window.adicionarLinhaContato();
    } else {
        window.location.href = "index.html";
    }
});

// --- 3. CRUD ---

// CARREGAR
async function carregarClientes() {
    tableBody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
    try {
        const q = query(collection(db, "clientes"), orderBy("nomeEmpresa"));
        const snapshot = await getDocs(q);
        
        tableBody.innerHTML = "";
        
        snapshot.forEach(docSnap => {
            const cliente = docSnap.data();
            const id = docSnap.id;
            
            // Formatar contatos para exibição
            let contatosHtml = "";
            if (cliente.contatos && cliente.contatos.length > 0) {
                cliente.contatos.forEach(c => {
                    contatosHtml += `<span class="contact-badge"><b>${c.nome}</b>: ${c.telefone}</span>`;
                });
            } else {
                contatosHtml = "<span style='color:#999; font-size:11px;'>Sem contatos</span>";
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${cliente.nomeEmpresa}</strong></td>
                <td>${contatosHtml}</td>
                <td>${cliente.endereco || '-'}</td>
                <td>
                    <button class="btn-action btn-edit">✏️</button>
                    <button class="btn-action btn-delete">🗑️</button>
                </td>
            `;

            // Eventos dos botões
            tr.querySelector('.btn-edit').onclick = () => editarCliente(id, cliente);
            tr.querySelector('.btn-delete').onclick = () => excluirCliente(id, cliente.nomeEmpresa);

            tableBody.appendChild(tr);
        });

    } catch (error) {
        console.error(error);
        tableBody.innerHTML = '<tr><td colspan="4">Erro ao carregar.</td></tr>';
    }
}

// SALVAR (Novo ou Edição)
btnSalvar.onclick = async () => {
    const nomeEmpresa = inpEmpresa.value.trim();
    if (!nomeEmpresa) return alert("Digite o nome da empresa!");

    // Coleta contatos
    const contatos = [];
    document.querySelectorAll('.contact-row').forEach(row => {
        const nome = row.querySelector('.inp-c-nome').value.trim();
        const tel = row.querySelector('.inp-c-tel').value.trim();
        const email = row.querySelector('.inp-c-email').value.trim();
        
        if (nome || tel || email) { // Só salva se tiver algum dado
            contatos.push({ nome, telefone: tel, email });
        }
    });

    const dados = {
        nomeEmpresa,
        endereco: inpEndereco.value.trim(),
        contatos, // Array de objetos
        dataAtualizacao: new Date().toISOString()
    };

    try {
        btnSalvar.disabled = true;
        btnSalvar.textContent = "Salvando...";

        if (editIdInput.value) {
            // Edição
            await updateDoc(doc(db, "clientes", editIdInput.value), dados);
            alert("Cliente atualizado!");
        } else {
            // Novo
            await addDoc(collection(db, "clientes"), dados);
            alert("Cliente cadastrado!");
        }

        limparFormulario();
        carregarClientes();

    } catch (error) {
        console.error(error);
        alert("Erro ao salvar: " + error.message);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = "💾 Salvar Cliente";
    }
};

// EDITAR
window.editarCliente = (id, data) => {
    editIdInput.value = id;
    inpEmpresa.value = data.nomeEmpresa;
    inpEndereco.value = data.endereco || "";
    
    // Limpa e recria lista de contatos
    contactsList.innerHTML = "";
    if (data.contatos && data.contatos.length > 0) {
        data.contatos.forEach(c => window.adicionarLinhaContato(c));
    } else {
        window.adicionarLinhaContato();
    }

    btnSalvar.textContent = "🔄 Atualizar Cliente";
    btnCancelar.style.display = "inline-block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// EXCLUIR
window.excluirCliente = async (id, nome) => {
    if (confirm(`Tem certeza que deseja excluir ${nome}?`)) {
        try {
            await deleteDoc(doc(db, "clientes", id));
            carregarClientes();
        } catch (error) {
            alert("Erro ao excluir: " + error.message);
        }
    }
};

// UTILITÁRIOS
function limparFormulario() {
    editIdInput.value = "";
    inpEmpresa.value = "";
    inpEndereco.value = "";
    contactsList.innerHTML = "";
    window.adicionarLinhaContato(); // Uma linha vazia
    btnSalvar.textContent = "💾 Salvar Cliente";
    btnCancelar.style.display = "none";
}

btnCancelar.onclick = limparFormulario;

// Busca Simples
inpBusca.addEventListener('input', () => {
    const termo = inpBusca.value.toLowerCase();
    const linhas = tableBody.querySelectorAll('tr');
    linhas.forEach(tr => {
        const texto = tr.textContent.toLowerCase();
        tr.style.display = texto.includes(termo) ? '' : 'none';
    });
});