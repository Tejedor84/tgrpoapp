import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, getDocs, query, orderBy, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Elementos
const userEmailSpan = document.getElementById('user-email');
const btnLogout = document.getElementById('btnLogout');
const form = document.getElementById('formPagamento');
const tableBody = document.getElementById('paymentsTableBody');
const totalDisplay = document.getElementById('totalDisplay');

// Selects e Botões
const selMember = document.getElementById('payMember');
const selEvent = document.getElementById('payEvent');
const selType = document.getElementById('payType');
const btnAddType = document.getElementById('btnAddType');
const filterStatus = document.getElementById('filterStatus');

let pagamentosLista = [];

// Autenticação
onAuthStateChanged(auth, (user) => {
    if (user) {
        if(userEmailSpan) userEmailSpan.textContent = user.email;
        carregarDadosIniciais();
    } else {
        window.location.href = "index.html";
    }
});

if(btnLogout) {
    btnLogout.addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = "index.html");
    });
}

// --- CARREGAR DADOS ---
async function carregarDadosIniciais() {
    await Promise.all([carregarSelects(), carregarTiposPagamento(), carregarPagamentos()]);
}

// 1. Carrega Equipe e Eventos
async function carregarSelects() {
    try {
        // Equipe
        selMember.innerHTML = '<option value="">Selecione um colaborador...</option>';
        const qEquipe = query(collection(db, "equipe"), orderBy("apelido"));
        const snapEquipe = await getDocs(qEquipe);
        
        if (snapEquipe.empty) {
            const opt = document.createElement('option');
            opt.textContent = "(Nenhum colaborador cadastrado)";
            opt.disabled = true;
            selMember.appendChild(opt);
        } else {
            snapEquipe.forEach(doc => {
                const d = doc.data();
                const option = document.createElement('option');
                option.value = d.apelido || d.nome;
                option.textContent = d.apelido ? `${d.apelido} (${d.nome})` : d.nome;
                selMember.appendChild(option);
            });
        }

        // Eventos
        selEvent.innerHTML = '<option value="">Geral / Sem Evento</option>';
        const qEventos = query(collection(db, "events"), orderBy("nome"));
        const snapEventos = await getDocs(qEventos);
        
        snapEventos.forEach(doc => {
            const ev = doc.data();
            const option = document.createElement('option');
            option.value = ev.nome;
            option.textContent = ev.nome;
            selEvent.appendChild(option);
        });

    } catch (error) {
        console.error("Erro ao carregar selects:", error);
    }
}

// 2. Carrega (e gerencia) os Tipos de Pagamento
async function carregarTiposPagamento() {
    try {
        selType.innerHTML = '<option value="">Carregando...</option>';
        
        // Busca na coleção de configurações
        const qTypes = query(collection(db, "config_payment_types"), orderBy("nome"));
        const snapshot = await getDocs(qTypes);

        // Se estiver vazio (primeiro uso), cria os padrões
        if (snapshot.empty) {
            console.log("Criando tipos padrão...");
            const padroes = ["Diária Técnica", "Carregador", "Alimentação", "Transporte", "Hospedagem", "Material", "Extra", "Adiantamento"];
            
            // Salva um por um e adiciona no select
            selType.innerHTML = '';
            for (const tipo of padroes) {
                await addDoc(collection(db, "config_payment_types"), { nome: tipo });
                const opt = document.createElement('option');
                opt.value = tipo;
                opt.textContent = tipo;
                selType.appendChild(opt);
            }
        } else {
            // Se já tem, apenas lista
            selType.innerHTML = '';
            snapshot.forEach(doc => {
                const d = doc.data();
                const opt = document.createElement('option');
                opt.value = d.nome;
                opt.textContent = d.nome;
                selType.appendChild(opt);
            });
        }

    } catch (error) {
        console.error("Erro ao carregar tipos:", error);
        selType.innerHTML = '<option value="Outro">Outro (Erro ao carregar)</option>';
    }
}

// Lógica do Botão Adicionar Tipo (+)
if(btnAddType) {
    btnAddType.addEventListener('click', async () => {
        const novoTipo = prompt("Digite o nome do novo Tipo de Pagamento:");
        
        if (novoTipo && novoTipo.trim() !== "") {
            const nomeFormatado = novoTipo.trim();
            
            // Adiciona no banco
            try {
                await addDoc(collection(db, "config_payment_types"), { nome: nomeFormatado });
                
                // Adiciona visualmente no select e seleciona ele
                const opt = document.createElement('option');
                opt.value = nomeFormatado;
                opt.textContent = nomeFormatado;
                selType.appendChild(opt);
                selType.value = nomeFormatado;

                alert(`Tipo "${nomeFormatado}" adicionado com sucesso!`);
            } catch (error) {
                console.error(error);
                alert("Erro ao salvar novo tipo.");
            }
        }
    });
}

// 3. Carrega a Lista de Pagamentos (Lançamentos)
async function carregarPagamentos() {
    try {
        const q = query(collection(db, "pagamentos"), orderBy("data", "desc"));
        const snapshot = await getDocs(q);
        
        pagamentosLista = [];
        snapshot.forEach(doc => {
            let dados = doc.data();
            dados.id = doc.id;
            pagamentosLista.push(dados);
        });

        filtrarLista(); 
    } catch (error) {
        console.error("Erro ao carregar pagamentos:", error);
        tableBody.innerHTML = '<tr><td colspan="5" align="center">Erro ao carregar dados.</td></tr>';
    }
}

// --- SALVAR NOVO PAGAMENTO ---
if(form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = form.querySelector('button[type="submit"]');
        const txtOriginal = btn.textContent;
        btn.textContent = "Salvando...";
        btn.disabled = true;

        const dados = {
            data: document.getElementById('payDate').value,
            colaborador: document.getElementById('payMember').value,
            evento: document.getElementById('payEvent').value || "Geral",
            tipo: document.getElementById('payType').value,
            valor: parseFloat(document.getElementById('payValue').value),
            obs: document.getElementById('payObs').value,
            status: "pendente", 
            criadoEm: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, "pagamentos"), dados);
            alert("Pagamento lançado!");
            form.reset();
            carregarPagamentos(); 
            // Recarrega os selects para manter sincronia
            carregarSelects();
            carregarTiposPagamento();
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar.");
        } finally {
            btn.textContent = txtOriginal;
            btn.disabled = false;
        }
    });
}

// --- FILTROS E RENDERIZAÇÃO ---
window.filtrarLista = () => {
    const status = filterStatus ? filterStatus.value : 'todos';
    
    const filtrados = pagamentosLista.filter(p => {
        if (status === 'todos') return true;
        return p.status === status;
    });

    renderizarTabela(filtrados);
};

function renderizarTabela(lista) {
    tableBody.innerHTML = "";
    let total = 0;

    if (lista.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" align="center" style="color:#888;">Nenhum lançamento encontrado.</td></tr>';
        totalDisplay.textContent = "R$ 0,00";
        return;
    }

    lista.forEach(p => {
        total += (p.valor || 0);
        
        const classeStatus = p.status === 'pago' ? 'status-pago' : 'status-pendente';
        const labelStatus = p.status === 'pago' ? 'Pago' : 'Pendente';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatarData(p.data)}</td>
            <td><strong>${p.colaborador}</strong><br><span style="font-size:12px; color:#888;">${p.tipo}</span></td>
            <td>${p.evento}</td>
            <td style="color: #FFD700;">R$ ${p.valor.toFixed(2)}</td>
            <td>
                <button class="btn-status ${classeStatus}" onclick="alternarStatus('${p.id}', '${p.status}')">
                    ${labelStatus}
                </button>
                <button class="btn-icon-delete" onclick="excluirPagamento('${p.id}')" style="margin-left:10px;">🗑️</button>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    totalDisplay.textContent = `R$ ${total.toFixed(2)}`;
}

window.alternarStatus = async (id, statusAtual) => {
    const novoStatus = statusAtual === 'pago' ? 'pendente' : 'pago';
    try {
        await updateDoc(doc(db, "pagamentos", id), { status: novoStatus });
        carregarPagamentos();
    } catch (e) {
        console.error(e);
        alert("Erro ao atualizar status.");
    }
};

window.excluirPagamento = async (id) => {
    if(confirm("Tem certeza que deseja excluir este lançamento?")) {
        try {
            await deleteDoc(doc(db, "pagamentos", id));
            carregarPagamentos();
        } catch (e) { console.error(e); }
    }
};

function formatarData(dataAmericana) {
    if(!dataAmericana) return "-";
    const [ano, mes, dia] = dataAmericana.split('-');
    return `${dia}/${mes}/${ano}`;
}