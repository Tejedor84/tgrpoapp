/* =================================================================
   PAGAMENTOS.JS - Reescrito para corresponder ao HTML atual
   ================================================================= */
import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, getDocs, query, orderBy, doc, deleteDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let pagamentosLista = [];
let filtroAtual = 'todos';

// --- ELEMENTOS ---
const paymentsList  = document.getElementById('paymentsList');
const totalMonth    = document.getElementById('totalMonthValue');
const btnNewPayment = document.getElementById('btnNewPayment');
const modal         = document.getElementById('modalPayment');
const form          = document.getElementById('formPayment');
const searchInput   = document.getElementById('searchInput');
const btnCancel     = document.getElementById('btnCancel');
const closeModal    = document.getElementById('closeModal');

// --- AUTH ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('user-email').textContent = user.email;
        carregarPagamentos();
    } else {
        window.location.href = "index.html";
    }
});

// --- CARREGAR ---
async function carregarPagamentos() {
    paymentsList.innerHTML = '<tr><td colspan="6" align="center">Carregando...</td></tr>';
    try {
        const q = query(collection(db, "pagamentos"), orderBy("dataCriacao", "desc"));
        const snap = await getDocs(q);
        pagamentosLista = [];
        snap.forEach(d => pagamentosLista.push({ id: d.id, ...d.data() }));
        renderizar();
    } catch (e) {
        console.error(e);
        paymentsList.innerHTML = '<tr><td colspan="6" align="center" style="color:red;">Erro ao carregar dados.</td></tr>';
    }
}

// --- RENDERIZAR ---
function renderizar() {
    const termo = (searchInput?.value || '').toLowerCase();

    const filtrados = pagamentosLista.filter(p => {
        const passaStatus = filtroAtual === 'todos' || p.status?.toLowerCase() === filtroAtual;
        const passaBusca  = !termo || (p.descricao || '').toLowerCase().includes(termo)
                                   || (p.categoria  || '').toLowerCase().includes(termo);

        // Filtro "atrasado": vencimento anterior a hoje e não pago
        if (filtroAtual === 'atrasado') {
            const hoje = new Date().toISOString().slice(0, 10);
            return p.status?.toLowerCase() !== 'pago' && p.vencimento < hoje && passaBusca;
        }
        return passaStatus && passaBusca;
    });

    paymentsList.innerHTML = '';
    let total = 0;

    if (filtrados.length === 0) {
        paymentsList.innerHTML = '<tr><td colspan="6" align="center" style="color:#888;">Nenhum pagamento encontrado.</td></tr>';
        totalMonth.textContent = 'R$ 0,00';
        return;
    }

    filtrados.forEach(p => {
        total += parseFloat(p.valor || 0);

        const statusLower = (p.status || 'Pendente').toLowerCase();
        let badgeStyle = '';
        if (statusLower === 'pago')    badgeStyle = 'background:#1a3a2a; color:#4ae07a;';
        if (statusLower === 'pendente') badgeStyle = 'background:#3a2a1a; color:#e0a04a;';
        if (statusLower === 'atrasado' || (statusLower === 'pendente' && p.vencimento < new Date().toISOString().slice(0,10)))
                                       badgeStyle = 'background:#3a1a1a; color:#e04a4a;';

        const vencFmt = p.vencimento ? p.vencimento.split('-').reverse().join('/') : '-';
        const valorFmt = parseFloat(p.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${vencFmt}</td>
            <td>${p.descricao || '-'}</td>
            <td>${p.categoria || '-'}</td>
            <td style="color:var(--primary-color); font-weight:600;">${valorFmt}</td>
            <td><span style="padding:3px 10px; border-radius:99px; font-size:0.8rem; font-weight:600; ${badgeStyle}">${p.status || 'Pendente'}</span></td>
            <td style="display:flex; gap:6px; align-items:center;">
                <button class="btn-secondary" style="padding:4px 10px; font-size:0.8rem;" onclick="toggleStatus('${p.id}','${p.status}')">
                    ${statusLower === 'pago' ? '↩ Desfazer' : '✓ Pagar'}
                </button>
                <button class="btn-secondary" style="padding:4px 10px; font-size:0.8rem; border-color:#ff4d4d; color:#ff4d4d;" onclick="excluirPagamento('${p.id}')">🗑️</button>
            </td>
        `;
        paymentsList.appendChild(tr);
    });

    totalMonth.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// --- FILTROS ---
window.filtrarStatus = function(status) {
    filtroAtual = status;
    // Destaca botão ativo
    document.querySelectorAll('.filter-tabs button').forEach(btn => {
        btn.style.borderColor = '';
        btn.style.color = '';
    });
    renderizar();
};

searchInput?.addEventListener('input', renderizar);

// --- MODAL ---
btnNewPayment?.addEventListener('click', () => {
    form.reset();
    document.getElementById('paymentId').value = '';
    document.getElementById('modalTitle').textContent = 'Novo Pagamento';
    modal.classList.remove('hidden');
});

const fechar = () => { modal.classList.add('hidden'); form.reset(); };
closeModal?.addEventListener('click', fechar);
btnCancel?.addEventListener('click', fechar);
modal?.addEventListener('click', (e) => { if (e.target === modal) fechar(); });

// --- SALVAR ---
form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const dados = {
        descricao:   document.getElementById('payDesc').value.trim(),
        valor:       parseFloat(document.getElementById('payValue').value) || 0,
        vencimento:  document.getElementById('payDate').value,
        categoria:   document.getElementById('payCategory').value,
        status:      document.getElementById('payStatus').value,
        obs:         document.getElementById('payObs').value.trim(),
        dataCriacao: serverTimestamp()
    };

    try {
        const id = document.getElementById('paymentId').value;
        if (id) {
            delete dados.dataCriacao;
            await updateDoc(doc(db, "pagamentos", id), dados);
        } else {
            await addDoc(collection(db, "pagamentos"), dados);
        }
        fechar();
        carregarPagamentos();
    } catch (err) {
        alert("Erro ao salvar: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salvar';
    }
});

// --- TOGGLE STATUS ---
window.toggleStatus = async (id, statusAtual) => {
    const novoStatus = statusAtual?.toLowerCase() === 'pago' ? 'Pendente' : 'Pago';
    try {
        await updateDoc(doc(db, "pagamentos", id), { status: novoStatus });
        carregarPagamentos();
    } catch (e) { alert("Erro: " + e.message); }
};

// --- EXCLUIR ---
window.excluirPagamento = async (id) => {
    if (confirm("Excluir este lançamento?")) {
        try {
            await deleteDoc(doc(db, "pagamentos", id));
            carregarPagamentos();
        } catch (e) { alert("Erro: " + e.message); }
    }
};