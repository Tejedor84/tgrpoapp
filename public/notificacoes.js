import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Elementos
const btnNovo = document.getElementById('btnNovoOrcamento');
const listaContainer = document.getElementById('lista-container');
const editorContainer = document.getElementById('editor-container');
const btnCancelar = document.getElementById('btnCancelar');
const itensContainer = document.getElementById('itens-container');
const btnAddSection = document.getElementById('btnAddSection');

// Campos de Usuário
const userNome = document.getElementById('userNome');
const userTelefone = document.getElementById('userTelefone');
const userEmail = document.getElementById('userEmail');

// Dados Meta
const propNumero = document.getElementById('propNumero');
const propData = document.getElementById('propData');

// Inicialização
onAuthStateChanged(auth, async (user) => {
    if (user) {
        carregarDadosUsuario(user);
        // carregarClientes(); // Será implementado depois
        // carregarLocais();   // Será implementado depois
    } else {
        window.location.href = "index.html";
    }
});

function carregarDadosUsuario(user) {
    // Aqui buscaremos do Firestore da coleção 'equipe'
    // Por enquanto, placeholder com o email do auth
    userEmail.textContent = user.email;
    // userNome.textContent = ... (buscar no banco)
    // userTelefone.textContent = ... (buscar no banco)
}

// --- CONTROLE DE TELA ---
btnNovo.addEventListener('click', () => {
    listaContainer.classList.add('hidden');
    editorContainer.classList.remove('hidden');
    iniciarNovoOrcamento();
});

btnCancelar.addEventListener('click', () => {
    if(confirm("Deseja cancelar? Dados não salvos serão perdidos.")) {
        editorContainer.classList.add('hidden');
        listaContainer.classList.remove('hidden');
    }
});

function iniciarNovoOrcamento() {
    // 1. Limpar campos
    itensContainer.innerHTML = '';
    document.querySelectorAll('.inp-clean').forEach(i => i.value = '');
    
    // 2. Definir Data Hoje
    propData.valueAsDate = new Date();
    
    // 3. Gerar Número (Mock por enquanto)
    propNumero.textContent = "20001"; // Lógica virá depois

    // 4. Adicionar uma seção padrão (ex: Sonorização) para não ficar vazio
    adicionarSecao("Sonorização");
}


// --- LÓGICA DE SEÇÕES E ITENS ---

const TIPOS_EQUIPAMENTO = [
    "Sonorização", "Imagem", "Estrutura", "Iluminação", "Acessórios", "Equipe Técnica", "Logística", "Investimento"
];

// Adicionar nova tabela de categoria
btnAddSection.addEventListener('click', () => adicionarSecao());

function adicionarSecao(tipoPadrao = "Sonorização") {
    const idSecao = Date.now(); // ID único temp
    
    const div = document.createElement('div');
    div.className = "items-section-block";
    div.innerHTML = `
        <div class="section-header">
            <label>CATEGORIA: </label>
            <select class="sel-categoria-secao" style="margin-left:10px;">
                ${TIPOS_EQUIPAMENTO.map(t => `<option value="${t}" ${t===tipoPadrao?'selected':''}>${t}</option>`).join('')}
            </select>
            <button class="btn-small btn-secondary btn-del-section no-print" style="margin-left:auto; background:red;">X</button>
        </div>

        <table class="items-table">
            <thead>
                <tr>
                    <th class="col-qtd">QTD</th>
                    <th class="col-desc">DESCRIÇÃO</th>
                    <th class="col-obs">OBS</th>
                    <th class="col-days">DIÁRIAS</th>
                    <th class="col-unit">UNIT (R$)</th>
                    <th class="col-total">TOTAL</th>
                    <th class="col-action no-print"></th>
                </tr>
            </thead>
            <tbody id="tbody-${idSecao}">
                </tbody>
        </table>

        <div class="no-print" style="margin-top:5px;">
            <button class="btn-small btn-secondary btn-add-item">+ Adicionar Item</button>
        </div>
        
        <div class="subtotal-row">
            Subtotal: <span class="span-subtotal">R$ 0,00</span>
        </div>
    `;

    itensContainer.appendChild(div);

    // Eventos da Seção
    const tbody = div.querySelector(`#tbody-${idSecao}`);
    const btnAdd = div.querySelector('.btn-add-item');
    const btnDelSec = div.querySelector('.btn-del-section');
    const selCat = div.querySelector('.sel-categoria-secao');

    // Adicionar primeiro item vazio
    adicionarItem(tbody, selCat.value);

    btnAdd.addEventListener('click', () => adicionarItem(tbody, selCat.value));
    
    // Ao mudar a categoria da seção, vamos (futuramente) filtrar os itens na busca
    selCat.addEventListener('change', () => {
        // Lógica futura: Atualizar filtros dos selects de itens dessa tabela
        console.log("Categoria mudou para:", selCat.value);
    });

    btnDelSec.addEventListener('click', () => {
        if(confirm("Remover esta seção inteira?")) div.remove();
        calcularTotalGeral();
    });
}

function adicionarItem(tbody, categoriaAtual) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="number" class="num-input inp-qtd" value="1" min="1"></td>
        <td>
            <input type="text" class="inp-desc" placeholder="Buscar item de ${categoriaAtual}..."> 
        </td>
        <td><input type="text" class="inp-obs" placeholder="..."></td>
        <td><input type="number" class="num-input inp-dias" value="1" min="1"></td>
        <td>
            <div style="display:flex; align-items:center">
                <input type="checkbox" class="chk-visible no-print" checked title="Visível no PDF?">
                <input type="number" class="money-input inp-unit" placeholder="0.00" step="0.01">
            </div>
        </td>
        <td class="col-total"><span class="span-total-row">R$ 0,00</span></td>
        <td class="col-action no-print"><button class="btn-small" style="color:red; background:none; border:none;">🗑️</button></td>
    `;

    // Botão Excluir Linha
    tr.querySelector('button').addEventListener('click', () => {
        tr.remove();
        calcularSubtotal(tbody);
    });

    // Eventos de Cálculo
    const inputs = tr.querySelectorAll('input');
    inputs.forEach(inp => {
        inp.addEventListener('input', () => {
            calcularLinha(tr);
            calcularSubtotal(tbody);
        });
    });

    tbody.appendChild(tr);
}

// --- CÁLCULOS ---

function calcularLinha(tr) {
    const qtd = parseFloat(tr.querySelector('.inp-qtd').value) || 0;
    const dias = parseFloat(tr.querySelector('.inp-dias').value) || 0;
    const unit = parseFloat(tr.querySelector('.inp-unit').value) || 0;
    
    const total = qtd * dias * unit;
    tr.querySelector('.span-total-row').textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    tr.dataset.total = total; // Salva valor numérico no data attribute
}

function calcularSubtotal(tbody) {
    let sub = 0;
    tbody.querySelectorAll('tr').forEach(tr => {
        sub += parseFloat(tr.dataset.total) || 0;
    });
    
    // Achar o elemento de subtotal correspondente (está fora da tabela, no pai)
    const container = tbody.closest('.items-section-block');
    container.querySelector('.span-subtotal').textContent = sub.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    calcularTotalGeral();
}

function calcularTotalGeral() {
    let total = 0;
    document.querySelectorAll('.items-section-block').forEach(sec => {
        // Pega o texto do subtotal, limpa e soma
        const txt = sec.querySelector('.span-subtotal').textContent;
        // Limpeza básica de string R$ para float
        const val = parseFloat(txt.replace('R$', '').replace(/\./g, '').replace(',', '').trim()) / 100;
        total += val;
    });
    
    document.getElementById('displayTotalGeral').textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}