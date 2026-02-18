import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { verificarPermissao } from "./auth-guard.js";

// Inputs
const inpNome = document.getElementById('inpNome');
const selCategoria = document.getElementById('selCategoria');
const inpQtd = document.getElementById('inpQtd');
const inpValor = document.getElementById('inpValor');
const inpLocalizacao = document.getElementById('inpLocalizacao');

const accessoriesList = document.getElementById('accessoriesList');
const btnSalvar = document.getElementById('btnSalvar');
const btnCancelar = document.getElementById('btnCancelar');
const editIdInput = document.getElementById('editId');
const tableBody = document.getElementById('tableBody');
const inpBusca = document.getElementById('inpBusca');

// --- 1. FUNÇÕES GLOBAIS ---
window.adicionarLinhaAcessorio = (texto = "") => {
    const div = document.createElement('div');
    div.className = 'contact-row';
    div.innerHTML = `
        <input type="text" class="inp-acc-nome" placeholder="Ex: Cabo AC, Case..." value="${texto}">
        <button class="btn-remove-contact" onclick="this.parentElement.remove()">x</button>
    `;
    accessoriesList.appendChild(div);
};

// --- 2. INICIALIZAÇÃO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('user-email').textContent = user.email;
        try { await verificarPermissao(db, user.email); } catch(e) {}
        
        carregarEquipamentos();
    } else {
        window.location.href = "index.html";
    }
});

// --- 3. CRUD ---
async function carregarEquipamentos() {
    tableBody.innerHTML = '<tr><td colspan="5">Carregando estoque...</td></tr>';
    try {
        const q = query(collection(db, "equipamentos"), orderBy("nome"));
        const snapshot = await getDocs(q);
        
        tableBody.innerHTML = "";
        
        snapshot.forEach(docSnap => {
            const item = docSnap.data();
            const id = docSnap.id;
            
            const valorFmt = parseFloat(item.valor || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
            const catClass = `cat-${item.categoria.replace(/\s/g, '')}`; // Classe para cor da badge

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <strong>${item.nome}</strong><br>
                    <span style="font-size:11px; color:#666;">${item.localizacao || ''}</span>
                </td>
                <td><span class="cat-badge ${catClass}">${item.categoria}</span></td>
                <td style="text-align: center;">${item.qtd || 0}</td>
                <td style="text-align: right;">${valorFmt}</td>
                <td>
                    <button class="btn-action btn-edit">✏️</button>
                    <button class="btn-action btn-delete">🗑️</button>
                </td>
            `;

            tr.querySelector('.btn-edit').onclick = () => editarEquipamento(id, item);
            tr.querySelector('.btn-delete').onclick = () => excluirEquipamento(id, item.nome);

            tableBody.appendChild(tr);
        });

    } catch (error) {
        console.error(error);
        tableBody.innerHTML = '<tr><td colspan="5">Erro ao carregar estoque.</td></tr>';
    }
}

btnSalvar.onclick = async () => {
    const nome = inpNome.value.trim();
    if (!nome) return alert("Digite o nome do equipamento!");

    const acessorios = [];
    document.querySelectorAll('.inp-acc-nome').forEach(inp => {
        if(inp.value.trim()) acessorios.push(inp.value.trim());
    });

    const dados = {
        nome,
        categoria: selCategoria.value,
        qtd: parseInt(inpQtd.value) || 0,
        valor: parseFloat(inpValor.value) || 0,
        localizacao: inpLocalizacao.value.trim(),
        acessorios, // Array de strings
        dataAtualizacao: new Date().toISOString()
    };

    try {
        btnSalvar.disabled = true;
        btnSalvar.textContent = "Salvando...";

        if (editIdInput.value) {
            await updateDoc(doc(db, "equipamentos", editIdInput.value), dados);
            alert("Equipamento atualizado!");
        } else {
            await addDoc(collection(db, "equipamentos"), dados);
            alert("Equipamento cadastrado!");
        }

        limparFormulario();
        carregarEquipamentos();

    } catch (error) {
        alert("Erro: " + error.message);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = "💾 Salvar Equipamento";
    }
};

window.editarEquipamento = (id, data) => {
    editIdInput.value = id;
    inpNome.value = data.nome;
    selCategoria.value = data.categoria;
    inpQtd.value = data.qtd;
    inpValor.value = data.valor;
    inpLocalizacao.value = data.localizacao || "";
    
    accessoriesList.innerHTML = "";
    if (data.acessorios && data.acessorios.length > 0) {
        data.acessorios.forEach(a => window.adicionarLinhaAcessorio(a));
    }

    btnSalvar.textContent = "🔄 Atualizar Item";
    btnCancelar.style.display = "inline-block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.excluirEquipamento = async (id, nome) => {
    if (confirm(`Excluir ${nome} do estoque?`)) {
        try {
            await deleteDoc(doc(db, "equipamentos", id));
            carregarEquipamentos();
        } catch (error) {
            alert("Erro: " + error.message);
        }
    }
};

function limparFormulario() {
    editIdInput.value = "";
    inpNome.value = "";
    inpQtd.value = "";
    inpValor.value = "";
    inpLocalizacao.value = "";
    accessoriesList.innerHTML = "";
    btnSalvar.textContent = "💾 Salvar Equipamento";
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