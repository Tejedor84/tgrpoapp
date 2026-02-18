/* =================================================================
   ORÇAMENTOS.JS - VERSÃO V10 MODULAR (CORREÇÃO DEFINITIVA)
   ================================================================= */

// 1. IMPORTAÇÕES (Isso conecta no seu firebase-init.js corretamente)
import { db } from './firebase-init.js';
import { 
    collection, 
    getDocs, 
    addDoc, 
    query, 
    orderBy, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Variáveis Globais
let equipamentosCache = [];
let clientesCache = [];
let linhaEdicaoAtual = null; 

// Inicialização ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    console.log("Sistema V10 Iniciado.");
    
    // Inicia carregamento
    carregarEquipamentos();
    carregarClientes();
    
    // Data atual
    const hoje = new Date();
    const campoData = document.getElementById('dataProposta');
    if (campoData) campoData.value = hoje.toLocaleDateString('pt-BR');
    
    // Adiciona sala padrão se vazio
    setTimeout(() => {
        const container = document.getElementById('containerSalas');
        if(container && container.children.length === 0) {
            window.adicionarSala();
        }
    }, 1000);
    
    // Fecha popups ao clicar fora
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.searchable-wrapper')) {
            document.querySelectorAll('.searchable-list').forEach(el => el.style.display = 'none');
        }
        if (e.target.id === 'modal-catalogo-completo') {
            window.fecharModalCatalogo();
        }
    });
});

/* =================================================================
   CARREGAMENTO DE DADOS (SINTAXE MODERNA V10)
   ================================================================= */

async function carregarEquipamentos() {
    console.log("Baixando estoque...");
    try {
        // Sintaxe correta V10: query + collection + getDocs
        const q = query(collection(db, "equipamentos"), orderBy("nome"));
        const querySnapshot = await getDocs(q);
        
        equipamentosCache = [];
        
        querySnapshot.forEach((doc) => {
            let data = doc.data();
            
            // TRATAMENTO DE PREÇO ROBUSTO
            // Tenta ler valor, preco ou precoDiaria
            let valorBruto = data.valor || data.preco || data.precoDiaria || "0";
            
            // Limpa R$, pontos e vírgulas para virar número puro
            let valorLimpo = String(valorBruto)
                .replace("R$", "")
                .trim()
                .replace(/\./g, "")   // Tira ponto de milhar
                .replace(",", ".");   // Troca vírgula por ponto decimal

            let precoFinal = parseFloat(valorLimpo);
            if (isNaN(precoFinal)) precoFinal = 0;

            equipamentosCache.push({
                id: doc.id,
                nome: data.nome || "Sem Nome",
                categoria: data.categoria || "Geral",
                preco: precoFinal
            });
        });
        console.log(`Sucesso: ${equipamentosCache.length} equipamentos carregados.`);
        
    } catch (error) {
        console.error("Erro ao baixar equipamentos:", error);
        alert("Erro de conexão. Verifique se o arquivo firebase-init.js está correto.");
    }
}

async function carregarClientes() {
    try {
        const q = query(collection(db, "clientes"), orderBy("nome"));
        const snap = await getDocs(q);
        clientesCache = [];
        snap.forEach(doc => clientesCache.push(doc.data()));
    } catch (error) {
        console.error("Erro clientes:", error);
    }
}

/* =================================================================
   FUNÇÕES GLOBAIS (WINDOW)
   Como usamos module, precisamos pendurar as funções em 'window'
   para o HTML (onclick) conseguir acessá-las.
   ================================================================= */

window.adicionarSala = function() {
    const container = document.getElementById('containerSalas');
    const idSala = 'sala_' + Date.now();
    
    const div = document.createElement('div');
    div.className = 'room-wrapper';
    div.id = idSala;
    
    div.innerHTML = `
        <div class="room-header">
            <input type="text" class="room-title-input" placeholder="NOME DO AMBIENTE" value="AMBIENTE 01">
            <button class="btn-del-room no-print" onclick="removerSala('${idSala}')">EXCLUIR SALA</button>
        </div>
        <div class="room-content">
            <button class="btn-add-cat-to-room no-print" onclick="adicionarCategoria('${idSala}')">+ ADICIONAR CATEGORIA</button>
            <div class="room-categories"></div>
        </div>
    `;
    container.appendChild(div);
    window.adicionarCategoria(idSala);
}

window.removerSala = function(idSala) {
    if(confirm("Excluir esta sala?")) {
        const el = document.getElementById(idSala);
        if(el) el.remove();
        window.calcularTotalGeral();
    }
}

window.adicionarCategoria = function(idSala) {
    const salaEl = document.getElementById(idSala);
    if(!salaEl) return;
    
    const salaDiv = salaEl.querySelector('.room-categories');
    const idCat = 'cat_' + Date.now();
    
    const div = document.createElement('div');
    div.className = 'item-group';
    div.id = idCat;
    
    div.innerHTML = `
        <div class="category-header">
            <label>CATEGORIA:</label>
            <select class="category-select">
                <option value="ILUMINAÇÃO">ILUMINAÇÃO</option>
                <option value="SONORIZAÇÃO">SONORIZAÇÃO</option>
                <option value="VÍDEO / PROJEÇÃO">VÍDEO / PROJEÇÃO</option>
                <option value="ESTRUTURA / BOX">ESTRUTURA / BOX</option>
                <option value="PAINEL DE LED">PAINEL DE LED</option>
                <option value="INFORMATICA">INFORMÁTICA</option>
                <option value="OUTROS">OUTROS</option>
            </select>
            <button class="btn-del-item no-print" onclick="this.closest('.item-group').remove(); calcularTotalGeral();">X</button>
        </div>
        
        <div class="items-header-row">
            <div class="col-qtd">QTD</div>
            <div class="col-desc">DESCRIÇÃO</div>
            <div class="col-obs">OBS</div>
            <div class="col-dias">DIAS</div>
            <div class="col-val">VALOR UNIT.</div>
            <div class="col-total">TOTAL</div>
            <div class="col-action no-print"></div>
        </div>
        
        <div class="group-items"></div>
        
        <div style="padding: 10px; background: #eee;" class="no-print">
            <button class="btn-sm" onclick="adicionarItemLinha('${idCat}')">+ ADICIONAR ITEM</button>
        </div>
    `;
    salaDiv.appendChild(div);
    window.adicionarItemLinha(idCat);
}

window.adicionarItemLinha = function(idCat) {
    const catEl = document.getElementById(idCat);
    if(!catEl) return;
    const groupDiv = catEl.querySelector('.group-items');
    
    const div = document.createElement('div');
    div.className = 'item-row';
    
    div.innerHTML = `
        <div class="col-qtd">
            <input type="number" class="qtd" value="1" min="1" onchange="calcLinha(this)">
        </div>
        <div class="col-desc">
            <div class="searchable-wrapper" style="flex:1;">
                <input type="text" class="searchable-input desc" placeholder="Buscar item..." 
                       onkeyup="buscarItemKeyUp(this)" autocomplete="off">
                <div class="searchable-list"></div>
            </div>
            <button class="btn-search-catalog no-print" type="button" onclick="abrirModalCatalogo(this)" title="Abrir Catálogo">
                <i class="fas fa-search"></i>
            </button>
        </div>
        <div class="col-obs">
            <input type="text" class="obs" placeholder="Detalhes...">
        </div>
        <div class="col-dias">
            <input type="number" class="dias" value="1" min="1" onchange="calcLinha(this)">
        </div>
        <div class="col-val">
            <input type="text" class="val" value="0,00" onchange="formatMoney(this); calcLinha(this)">
        </div>
        <div class="col-total">R$ 0,00</div>
        <div class="col-action no-print">
            <button class="btn-del-item" onclick="removerItemLinha(this)">X</button>
        </div>
    `;
    groupDiv.appendChild(div);
}

window.removerItemLinha = function(btn) {
    btn.closest('.item-row').remove();
    window.calcularTotalGeral();
}

window.calcLinha = function(elemento) {
    const row = elemento.closest('.item-row');
    if(!row) return;

    const qtd = parseFloat(row.querySelector('.qtd').value) || 0;
    const dias = parseFloat(row.querySelector('.dias').value) || 0;
    
    let valStr = String(row.querySelector('.val').value);
    valStr = valStr.replace(/\./g, '').replace(',', '.');
    const val = parseFloat(valStr) || 0;
    
    const total = qtd * dias * val;
    row.querySelector('.col-total').innerText = total.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    window.calcularTotalGeral();
}

window.calcularTotalGeral = function() {
    let subtotal = 0;
    document.querySelectorAll('.item-row .col-total').forEach(td => {
        let txt = td.innerText.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
        txt = txt.replace(/\u00A0/g, ''); 
        subtotal += parseFloat(txt) || 0;
    });
    
    const descEl = document.getElementById('inputDesconto');
    const desconto = descEl ? (parseFloat(descEl.value) || 0) : 0;
    
    document.getElementById('labelSubtotal').innerText = subtotal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    document.getElementById('labelTotalFinal').innerText = (subtotal - desconto).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
}

window.formatMoney = function(input) {
    let valStr = input.value.replace(/\./g, '').replace(',', '.');
    let val = parseFloat(valStr);
    if(isNaN(val)) val = 0;
    input.value = val.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

/* =================================================================
   BUSCA E AUTOCOMPLETE (BLINDADO)
   ================================================================= */

window.buscarItemKeyUp = function(input) {
    const termo = input.value.toLowerCase().trim();
    const wrapper = input.closest('.searchable-wrapper');
    if (!wrapper) return; 
    const listDiv = wrapper.querySelector('.searchable-list');
    
    if (termo.length < 2) {
        listDiv.style.display = 'none';
        return;
    }

    // Busca protegida contra nulos
    const filtrados = equipamentosCache.filter(e => {
        const nomeS = String(e.nome || '').toLowerCase();
        return nomeS.includes(termo);
    });
    
    listDiv.innerHTML = '';
    
    if (filtrados.length > 0) {
        filtrados.forEach(item => {
            const div = document.createElement('div');
            div.className = 'searchable-option';
            div.innerHTML = `
                <div><strong>${item.nome}</strong> <span>${item.categoria}</span></div>
                <div class="price-tag">R$ ${item.preco.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
            `;
            div.onmousedown = (e) => e.preventDefault(); 
            div.onclick = () => window.selecionarItemRapido(input, item);
            listDiv.appendChild(div);
        });
        listDiv.style.display = 'block';
    } else {
        listDiv.style.display = 'none';
    }
}

window.selecionarItemRapido = function(input, item) {
    const row = input.closest('.item-row');
    input.value = item.nome;
    const valInput = row.querySelector('.val');
    valInput.value = item.preco.toLocaleString('pt-BR', {minimumFractionDigits: 2});
    
    const wrapper = input.closest('.searchable-wrapper');
    if(wrapper) wrapper.querySelector('.searchable-list').style.display = 'none';
    
    window.calcLinha(valInput);
}

// LUPA / MODAL
window.abrirModalCatalogo = function(btnElement) {
    linhaEdicaoAtual = btnElement.closest('.item-row');
    const modal = document.getElementById('modal-catalogo-completo');
    const inputBusca = document.getElementById('inputBuscaModal');
    
    if(inputBusca) inputBusca.value = '';
    
    // Se estiver vazio, tenta recarregar
    if (equipamentosCache.length === 0) carregarEquipamentos();
    
    window.renderizarTabela(equipamentosCache);
    
    if(modal) modal.style.display = 'flex';
    if(inputBusca) setTimeout(() => inputBusca.focus(), 100);
}

window.fecharModalCatalogo = function() {
    const modal = document.getElementById('modal-catalogo-completo');
    if(modal) modal.style.display = 'none';
    linhaEdicaoAtual = null;
}

window.filtrarTabelaCatalogo = function() {
    const input = document.getElementById('inputBuscaModal');
    const termo = input.value.toLowerCase().trim();
    
    const filtrados = equipamentosCache.filter(item => {
        const nomeS = String(item.nome || '').toLowerCase();
        const catS = String(item.categoria || '').toLowerCase();
        return nomeS.includes(termo) || catS.includes(termo);
    });
    window.renderizarTabela(filtrados);
}

window.renderizarTabela = function(lista) {
    const tbody = document.getElementById('tbodyCatalogo');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:15px;">Nenhum item encontrado.</td></tr>';
        return;
    }
    
    lista.forEach(item => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.innerHTML = `
            <td><strong>${item.nome}</strong></td>
            <td><span class="cat-tag">${item.categoria}</span></td>
            <td style="text-align:right; font-weight:bold; color:#007bff;">
                R$ ${item.preco.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
            </td>
        `;
        tr.onclick = () => window.selecionarItemDoCatalogo(item);
        tbody.appendChild(tr);
    });
}

window.selecionarItemDoCatalogo = function(item) {
    if (linhaEdicaoAtual) {
        linhaEdicaoAtual.querySelector('.desc').value = item.nome;
        const inputVal = linhaEdicaoAtual.querySelector('.val');
        inputVal.value = item.preco.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        window.calcLinha(inputVal);
    }
    window.fecharModalCatalogo();
}

// CLIENTES
window.buscarClienteKeyUp = function(input) {
    const termo = input.value.toLowerCase().trim();
    const listDiv = document.getElementById('listaClientes'); 
    
    if (termo.length < 2) {
        listDiv.style.display = 'none';
        return;
    }
    
    const filtrados = clientesCache.filter(c => String(c.nome || '').toLowerCase().includes(termo));
    listDiv.innerHTML = '';
    
    if (filtrados.length > 0) {
        filtrados.forEach(c => {
            const div = document.createElement('div');
            div.className = 'searchable-option';
            div.innerHTML = `<strong>${c.nome}</strong>`;
            div.onmousedown = (e) => e.preventDefault();
            div.onclick = () => window.preencherCliente(c);
            listDiv.appendChild(div);
        });
        listDiv.style.display = 'block';
    } else {
        listDiv.style.display = 'none';
    }
}

window.preencherCliente = function(c) {
    document.getElementById('buscaCliente').value = c.nome;
    document.getElementById('nomeSolicitante').value = c.responsavel || '';
    document.getElementById('emailCliente').value = c.email || '';
    document.getElementById('cnpjCliente').value = c.cnpj || '';
    document.getElementById('telCliente').value = c.telefone || '';
    document.getElementById('cidadeCliente').value = c.endereco || '';
    document.getElementById('listaClientes').style.display = 'none';
}

/* =================================================================
   SALVAR ORÇAMENTO
   ================================================================= */

window.salvarOrcamento = function() {
    const btnSalvar = document.querySelector('button[onclick="salvarOrcamento()"]');
    const txtOriginal = btnSalvar ? btnSalvar.innerText : "Salvar";
    if (btnSalvar) {
        btnSalvar.innerText = "Salvando...";
        btnSalvar.disabled = true;
    }

    const orcamento = {
        dataCriacao: serverTimestamp(),
        proposta: document.getElementById('numProposta').value,
        dataProposta: document.getElementById('dataProposta').value,
        status: document.getElementById('statusOrcamento').value,
        cliente: {
            nome: document.getElementById('buscaCliente').value,
            solicitante: document.getElementById('nomeSolicitante').value,
            email: document.getElementById('emailCliente').value,
            cnpj: document.getElementById('cnpjCliente').value,
            telefone: document.getElementById('telCliente').value,
            cidade: document.getElementById('cidadeCliente').value
        },
        evento: {
            nome: document.getElementById('nomeEvento').value,
            local: document.getElementById('localEvento').value,
            montagem: document.getElementById('dataMontagem').value,
            inicio: document.getElementById('dataInicio').value,
            termino: document.getElementById('dataTermino').value,
            desmontagem: document.getElementById('dataDesmontagem').value
        },
        salas: [],
        total: document.getElementById('labelTotalFinal').innerText,
        obs: document.getElementById('obsGerais').value
    };

    document.querySelectorAll('.room-wrapper').forEach(salaDiv => {
        const salaObj = {
            nome: salaDiv.querySelector('.room-title-input').value,
            categorias: []
        };
        salaDiv.querySelectorAll('.item-group').forEach(catDiv => {
            const catObj = {
                nome: catDiv.querySelector('.category-select').value,
                itens: []
            };
            catDiv.querySelectorAll('.item-row').forEach(row => {
                catObj.itens.push({
                    qtd: row.querySelector('.qtd').value,
                    descricao: row.querySelector('.desc').value,
                    obs: row.querySelector('.obs').value,
                    dias: row.querySelector('.dias').value,
                    valor: row.querySelector('.val').value,
                    total: row.querySelector('.col-total').innerText
                });
            });
            salaObj.categorias.push(catObj);
        });
        orcamento.salas.push(salaObj);
    });

    addDoc(collection(db, "orcamentos"), orcamento)
    .then(() => {
        alert("Salvo com sucesso!");
        if (btnSalvar) {
            btnSalvar.innerText = txtOriginal;
            btnSalvar.disabled = false;
        }
    })
    .catch(err => {
        console.error(err);
        alert("Erro ao salvar: " + err.message);
        if (btnSalvar) {
            btnSalvar.innerText = txtOriginal;
            btnSalvar.disabled = false;
        }
    });
}