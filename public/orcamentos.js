/* =================================================================
   ORCAMENTOS.JS - V30 — TOTAIS COMPLETOS + SUBTOTAL POR SALA
   ================================================================= */
import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, addDoc, updateDoc, getDoc, doc, query, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Categorias que contam como EQUIPAMENTO (tudo que não é MO, DJ ou BACKDROP)
const CATS_MO       = new Set(['MÃO DE OBRA', 'MAO DE OBRA', 'EQUIPE', 'EQUIPE TÉCNICA']);
const CATS_DJ       = new Set(['DJ', 'SERVIÇO DE DJ', 'SERVICO DE DJ']);
const CATS_BACKDROP = new Set(['BACKDROP', 'SERVIÇO DE BACKDROP', 'SERVICO DE BACKDROP']);

let equipamentosCache = [], clientesCache = [], locaisCache = [], linhaEdicaoAtual = null;
let orcamentoEditandoId = null; // ID do doc Firestore quando estiver editando proposta existente

// --- INIT ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (document.getElementById('user-email'))
            document.getElementById('user-email').textContent = user.email;
        await carregarDadosVendedor(user.email);
        await gerarNumeroProposta();
        carregarEquipamentos();
        carregarClientes();
        carregarLocais();
        // Se vier com ?id=xxx na URL, carrega proposta existente para edição
        const urlParams = new URLSearchParams(window.location.search);
        const idEditar = urlParams.get('id');
        if (idEditar) carregarPropostaExistente(idEditar);
    } else {
        window.location.href = "index.html";
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Data da proposta
    const hoje = new Date();
    const el = document.getElementById('dataProposta');
    if (el) el.value = hoje.toLocaleDateString('pt-BR');

    // Primeira sala automática
    setTimeout(() => {
        const container = document.getElementById('containerSalas');
        if (container && container.children.length === 0) window.adicionarSala();
    }, 800);

    // Fecha dropdowns ao clicar fora
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.searchable-wrapper'))
            document.querySelectorAll('.searchable-list').forEach(el => el.style.display = 'none');
        if (e.target.id === 'modal-catalogo-completo') window.fecharModalCatalogo();
    });
});

/* =================================================================
   ATENDENTE — busca do Firestore (usuarios_permissoes)
   ================================================================= */
async function carregarDadosVendedor(email) {
    // Dados ficam na coleção 'equipe' com o email como ID do documento
    try {
        const snap = await getDoc(doc(db, "equipe", email));
        if (snap.exists()) {
            const d = snap.data();
            const nome = d.nome || '';
            const tel  = d.telefone || d.whatsapp || d.tel || '';
            if (document.getElementById('nomeAtendente'))
                document.getElementById('nomeAtendente').value = nome;
            if (document.getElementById('telAtendente'))
                document.getElementById('telAtendente').value = tel;
        } else {
            console.warn("Usuário não encontrado na coleção equipe:", email);
        }
    } catch (e) {
        console.warn("Erro ao carregar dados do vendedor:", e);
    }
    // Email sempre vem do auth
    if (document.getElementById('emailAtendente'))
        document.getElementById('emailAtendente').value = email;
}

/* =================================================================
   NÚMERO DA PROPOSTA — automático, mínimo 200, formato 00200/2026
   ================================================================= */
async function gerarNumeroProposta() {
    const MINIMO = 200;
    const ano    = new Date().getFullYear();
    try {
        const q    = query(collection(db, "orcamentos"), orderBy("dataCriacao", "desc"), limit(1));
        const snap = await getDocs(q);
        let numero = MINIMO;
        if (!snap.empty) {
            const ultimo  = snap.docs[0].data().proposta || '';
            const match   = ultimo.match(/^0*(\d+)/);
            if (match) {
                const n = parseInt(match[1], 10);
                if (!isNaN(n) && n >= MINIMO) numero = n + 1;
            }
        }
        const numStr = String(numero).padStart(5, '0');
        document.getElementById('numProposta').value = `${numStr}/${ano}`;
    } catch (e) {
        const numStr = String(MINIMO).padStart(5, '0');
        document.getElementById('numProposta').value = `${numStr}/${ano}`;
    }
}

/* =================================================================
   ESTRUTURA: SALAS, CATEGORIAS, ITENS
   ================================================================= */
window.adicionarSala = function() {
    const id  = 'sala_' + Date.now();
    const div = document.createElement('div');
    div.className = 'room-wrapper';
    div.id = id;
    div.innerHTML = `
        <div class="room-header">
            <input type="text" class="room-title-input" value="AMBIENTE 01">
            <button class="btn-del-room no-print" onclick="this.closest('.room-wrapper').remove(); window.calcularTotalGeral()">EXCLUIR SALA</button>
        </div>
        <div class="room-content">
            <button class="btn-add-cat-to-room no-print" onclick="adicionarCategoria('${id}')">+ ADICIONAR CATEGORIA</button>
            <div class="room-categories"></div>
        </div>
        <div class="room-subtotal-bar">
            <div class="room-sub-row row-equip" style="display:none;">
                <span>Equipamentos:</span><strong class="room-equip-val">R$ 0,00</strong>
            </div>
            <div class="room-sub-row row-mo" style="display:none;">
                <span>Mão de Obra:</span><strong class="room-mo-val">R$ 0,00</strong>
            </div>
            <div class="room-sub-row row-dj" style="display:none;">
                <span>DJ:</span><strong class="room-dj-val">R$ 0,00</strong>
            </div>
            <div class="room-sub-row row-backdrop" style="display:none;">
                <span>Backdrop:</span><strong class="room-backdrop-val">R$ 0,00</strong>
            </div>
            <div class="room-sub-row row-total">
                <span>Subtotal do Ambiente:</span><strong class="room-total-val">R$ 0,00</strong>
            </div>
        </div>`;
    document.getElementById('containerSalas').appendChild(div);
    window.adicionarCategoria(id);
};

window.adicionarCategoria = function(idSala) {
    const idCat = 'cat_' + Date.now();
    const div   = document.createElement('div');
    div.className = 'item-group';
    div.id = idCat;
    div.innerHTML = `
        <div class="category-header">
            <select class="category-select" onchange="window.calcularTotalGeral()">
                <option>SONORIZAÇÃO</option>
                <option>ILUMINAÇÃO</option>
                <option>VÍDEO / PROJEÇÃO</option>
                <option>ESTRUTURA / BOX</option>
                <option>PAINEL DE LED</option>
                <option>INFORMÁTICA</option>
                <option>MÃO DE OBRA</option>
                <option>ILUMINAÇÃO CÊNICA</option>
                <option>DJ</option>
                <option>BACKDROP</option>
                <option>OUTROS</option>
            </select>
            <button class="btn-del-item no-print" onclick="this.closest('.item-group').remove(); window.calcularTotalGeral()">×</button>
        </div>
        <div class="items-header-row grid-layout">
            <div style="text-align:center;">QTD</div>
            <div>DESCRIÇÃO</div>
            <div>OBS</div>
            <div style="text-align:center;">DIAS</div>
            <div style="text-align:right;">UNIT.</div>
            <div style="text-align:right;">TOTAL</div>
            <div class="no-print"></div>
        </div>
        <div class="group-items"></div>
        <div class="no-print">
            <button class="btn-add-item-row" onclick="adicionarItemLinha('${idCat}')">+ ADICIONAR ITEM</button>
        </div>`;
    document.getElementById(idSala).querySelector('.room-categories').appendChild(div);
    window.adicionarItemLinha(idCat);
};

window.adicionarItemLinha = function(idCat) {
    const div = document.createElement('div');
    div.className = 'item-row grid-layout';
    div.innerHTML = `
        <div class="col-qtd"><input type="number" class="qtd" value="1" min="1" onchange="calcLinha(this)"></div>
        <div class="col-desc">
            <div class="desc-wrapper">
                <div class="searchable-wrapper">
                    <input type="text" class="searchable-input desc" placeholder="Buscar item..." onkeyup="buscarItemKeyUp(this)">
                    <div class="searchable-list"></div>
                </div>
                <button type="button" class="btn-search-icon no-print" onclick="window.abrirModalCatalogo(this)" title="Buscar no Catálogo">
                    <i class="fas fa-search"></i>
                </button>
            </div>
        </div>
        <div class="col-obs"><input type="text" class="obs" placeholder="-"></div>
        <div class="col-dias"><input type="number" class="dias" value="1" min="1" onchange="calcLinha(this)"></div>
        <div class="col-val"><input type="text" class="val" value="0,00" onchange="formatMoney(this); calcLinha(this)"></div>
        <div class="col-total">R$ 0,00</div>
        <div class="col-action no-print">
            <button class="btn-del-item" onclick="this.closest('.item-row').remove(); calcularTotalGeral()">×</button>
        </div>`;
    document.getElementById(idCat).querySelector('.group-items').appendChild(div);
};

/* =================================================================
   CÁLCULOS
   ================================================================= */
window.calcLinha = function(el) {
    const row  = el.closest('.item-row');
    const qtd  = parseFloat(row.querySelector('.qtd').value) || 0;
    const dias = parseFloat(row.querySelector('.dias').value) || 0;
    const val  = parseMoney(row.querySelector('.val').value);
    row.querySelector('.col-total').innerText = fmtBRL(qtd * dias * val);
    window.calcularTotalGeral();
};

window.formatMoney = function(input) {
    input.value = parseMoney(input.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
};

function parseMoney(str) {
    return parseFloat((str || '0').replace(/R\$\s*/g, '').replace(/\u00a0/g, '').replace(/\./g, '').replace(',', '.').trim()) || 0;
}

function fmtBRL(val) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function classifyCategory(catSelectValue) {
    const v = (catSelectValue || '').toUpperCase().trim();
    if (CATS_MO.has(v))       return 'mo';
    if (CATS_DJ.has(v))       return 'dj';
    if (CATS_BACKDROP.has(v)) return 'backdrop';
    return 'equip';
}

window.calcularTotalGeral = function() {
    let totalEquip = 0, totalMO = 0, totalDJ = 0, totalBackdrop = 0;

    // Calcula por sala e atualiza subtotais
    document.querySelectorAll('.room-wrapper').forEach(room => {
        let rEquip = 0, rMO = 0, rDJ = 0, rBackdrop = 0;

        room.querySelectorAll('.item-group').forEach(group => {
            const tipo    = classifyCategory(group.querySelector('.category-select')?.value);
            let groupSum  = 0;
            group.querySelectorAll('.col-total').forEach(el => { groupSum += parseMoney(el.innerText); });

            if (tipo === 'mo')       rMO       += groupSum;
            else if (tipo === 'dj')       rDJ       += groupSum;
            else if (tipo === 'backdrop') rBackdrop += groupSum;
            else                          rEquip    += groupSum;
        });

        totalEquip    += rEquip;
        totalMO       += rMO;
        totalDJ       += rDJ;
        totalBackdrop += rBackdrop;

        // Subtotal visual do ambiente
        const bar = room.querySelector('.room-subtotal-bar');
        if (bar) {
            const rTotal = rEquip + rMO + rDJ + rBackdrop;
            const show = (row, val, cls) => {
                row.style.display = val > 0 ? 'flex' : 'none';
                row.querySelector(cls).innerText = fmtBRL(val);
            };
            show(bar.querySelector('.row-equip'),   rEquip,    '.room-equip-val');
            show(bar.querySelector('.row-mo'),      rMO,       '.room-mo-val');
            show(bar.querySelector('.row-dj'),      rDJ,       '.room-dj-val');
            show(bar.querySelector('.row-backdrop'), rBackdrop, '.room-backdrop-val');
            bar.querySelector('.room-total-val').innerText = fmtBRL(rTotal);
        }
    });

    // Desconto somente sobre equipamentos
    const desconto       = Math.max(0, parseFloat(document.getElementById('inputDesconto')?.value) || 0);
    const equipLiquido   = Math.max(0, totalEquip - desconto);
    const totalSemNota   = equipLiquido + totalMO + totalDJ + totalBackdrop;

    // Imposto
    const impostoRate    = parseFloat(document.getElementById('selectImposto')?.value) || 0;
    const valorImposto   = totalSemNota * impostoRate;
    const totalComImposto= totalSemNota + valorImposto;

    // Cartão
    const chkCartao      = document.getElementById('chkCartao');
    const taxaCartao     = chkCartao?.checked ? totalComImposto * 0.05 : 0;
    const totalFinal     = totalComImposto + taxaCartao;

    // ---- Atualiza DOM ----
    setText('labelTotalEquip',      fmtBRL(totalEquip));
    setText('labelTotalMaoObra',    fmtBRL(totalMO));
    setText('labelTotalSemNota',    fmtBRL(totalSemNota));
    setText('labelImposto',         fmtBRL(valorImposto));
    setText('labelTotalComImposto', fmtBRL(totalComImposto));
    setText('labelTotalFinal',      fmtBRL(totalFinal));
    setText('labelDesconto',        fmtBRL(desconto));  // versão impressão

    // DJ e Backdrop — mostra só quando > 0
    toggleRow('rowTotalDJ',       totalDJ > 0,       'labelTotalDJ',       fmtBRL(totalDJ));
    toggleRow('rowTotalBackdrop', totalBackdrop > 0,  'labelTotalBackdrop', fmtBRL(totalBackdrop));
    toggleRow('rowTaxaCartao',    chkCartao?.checked, 'labelTaxaCartao',    fmtBRL(taxaCartao));

    // Tipo do imposto para impressão
    const tipoLabel = { '0': '', '0.14': 'NF 14%', '0.10': 'Fatura 10%' };
    setText('labelImpostoTipo', tipoLabel[String(impostoRate)] || '');
};

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
}

function toggleRow(rowId, show, labelId, val) {
    const row = document.getElementById(rowId);
    if (!row) return;
    row.style.display = show ? '' : 'none';
    if (show) setText(labelId, val);
}

/* =================================================================
   BUSCA DE ITENS / AUTOCOMPLETE
   ================================================================= */
window.buscarItemKeyUp = function(input) {
    const t    = input.value.toLowerCase().trim();
    const list = input.closest('.searchable-wrapper').querySelector('.searchable-list');
    list.innerHTML = ''; list.style.display = 'none';
    if (t.length < 2) return;
    const f = equipamentosCache.filter(e => e.nome.toLowerCase().includes(t));
    if (f.length) {
        f.forEach(e => {
            const d = document.createElement('div');
            d.className = 'searchable-option';
            d.innerHTML = `<strong>${e.nome}</strong>`;
            d.onclick = () => {
                const row = input.closest('.item-row');
                input.value = e.nome;
                row.querySelector('.val').value = e.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                window.calcLinha(row.querySelector('.val'));
                list.style.display = 'none';
            };
            list.appendChild(d);
        });
        list.style.display = 'block';
    }
};

/* =================================================================
   MODAL DE CATÁLOGO
   ================================================================= */
window.abrirModalCatalogo = function(btnElement) {
    linhaEdicaoAtual = btnElement.closest('.item-row');
    const modal      = document.getElementById('modal-catalogo-completo');
    const inputBusca = document.getElementById('inputBuscaModal');
    if (inputBusca) inputBusca.value = '';
    if (equipamentosCache.length === 0) carregarEquipamentos();
    window.renderizarTabela(equipamentosCache);
    if (modal) modal.style.display = 'flex';
    if (inputBusca) setTimeout(() => inputBusca.focus(), 100);
};

window.fecharModalCatalogo = function() {
    const modal = document.getElementById('modal-catalogo-completo');
    if (modal) modal.style.display = 'none';
    linhaEdicaoAtual = null;
};

window.filtrarTabelaCatalogo = function() {
    const termo    = document.getElementById('inputBuscaModal').value.toLowerCase().trim();
    const filtrados = equipamentosCache.filter(item => String(item.nome || '').toLowerCase().includes(termo));
    window.renderizarTabela(filtrados);
};

window.renderizarTabela = function(lista) {
    const tbody = document.getElementById('tbodyCatalogo');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Nenhum item encontrado.</td></tr>';
        return;
    }
    lista.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${item.nome}</strong></td><td>${item.categoria}</td><td style="text-align:right;">${fmtBRL(item.preco)}</td>`;
        tr.onclick = () => {
            if (linhaEdicaoAtual) {
                linhaEdicaoAtual.querySelector('.desc').value = item.nome;
                const inputVal = linhaEdicaoAtual.querySelector('.val');
                inputVal.value = item.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                window.calcLinha(inputVal);
            }
            window.fecharModalCatalogo();
        };
        tbody.appendChild(tr);
    });
};

/* =================================================================
   FIREBASE — CARREGAMENTO DE DADOS
   ================================================================= */
async function carregarEquipamentos() {
    const q    = query(collection(db, "equipamentos"), orderBy("nome"));
    const snap = await getDocs(q);
    equipamentosCache = [];
    snap.forEach(d => {
        const val = parseMoney(String(d.data().valor || d.data().preco || '0'));
        equipamentosCache.push({ id: d.id, nome: d.data().nome, categoria: d.data().categoria, preco: isNaN(val) ? 0 : val });
    });
}

async function carregarClientes() {
    const q    = query(collection(db, "clientes"), orderBy("nomeEmpresa"));
    const snap = await getDocs(q);
    clientesCache = [];
    snap.forEach(d => clientesCache.push({ id: d.id, ...d.data() }));
}

async function carregarLocais() {
    const q    = query(collection(db, "locais"), orderBy("nome"));
    const snap = await getDocs(q);
    locaisCache = [];
    snap.forEach(d => locaisCache.push(d.data()));
}

/* =================================================================
   BUSCA DE CLIENTES E LOCAIS
   ================================================================= */
window.buscarClienteKeyUp = function(input) {
    const t    = input.value.toLowerCase().trim();
    const list = document.getElementById('listaClientes');
    list.innerHTML = ''; list.style.display = 'none';
    if (t.length < 2) return;
    const f = clientesCache.filter(c => String(c.nomeEmpresa || '').toLowerCase().includes(t));
    if (f.length) {
        f.forEach(c => {
            const d = document.createElement('div');
            d.className = 'searchable-option';
            d.innerText = c.nomeEmpresa;
            d.onclick = () => {
                // Nome da empresa
                document.getElementById('buscaCliente').value = c.nomeEmpresa || '';
                // Primeiro contato do array (email e telefone)
                const contato = (c.contatos && c.contatos.length > 0) ? c.contatos[0] : {};
                document.getElementById('emailCliente').value = contato.email    || '';
                document.getElementById('telCliente').value   = contato.telefone || '';
                // Mostra dropdown de contatos se houver mais de um
                if (c.contatos && c.contatos.length > 1) {
                    list.innerHTML = '';
                    c.contatos.forEach(ct => {
                        const opt = document.createElement('div');
                        opt.className = 'searchable-option';
                        opt.innerHTML = `<strong>${ct.nome}</strong> — ${ct.telefone || ''} ${ct.email || ''}`;
                        opt.onclick = () => {
                            document.getElementById('emailCliente').value = ct.email    || '';
                            document.getElementById('telCliente').value   = ct.telefone || '';
                            list.style.display = 'none';
                        };
                        list.appendChild(opt);
                    });
                    list.style.display = 'block';
                } else {
                    list.style.display = 'none';
                }
            };
            list.appendChild(d);
        });
        list.style.display = 'block';
    }
};

window.buscarLocalKeyUp = function(input) {
    const t    = input.value.toLowerCase().trim();
    const list = document.getElementById('listaLocais');
    list.innerHTML = ''; list.style.display = 'none';
    if (t.length < 2) return;
    const f = locaisCache.filter(l => String(l.nome || '').toLowerCase().includes(t));
    if (f.length) {
        f.forEach(l => {
            const d = document.createElement('div');
            d.className = 'searchable-option';
            d.innerText = l.nome;
            d.onclick = () => { input.value = l.nome; list.style.display = 'none'; };
            list.appendChild(d);
        });
        list.style.display = 'block';
    }
};

/* =================================================================
   SALVAR ORÇAMENTO
   ================================================================= */
window.salvarOrcamento = function() {
    const btn = document.querySelector('button[onclick="window.salvarOrcamento()"]');
    const txt = btn.innerText;
    btn.innerText = 'Salvando...'; btn.disabled = true;

    const orcamento = {
        dataCriacao:  serverTimestamp(),
        proposta:     document.getElementById('numProposta').value,
        dataProposta: document.getElementById('dataProposta').value,
        status:       document.getElementById('statusOrcamento').value,
        cliente: {
            empresa:  document.getElementById('buscaCliente').value,
            contato:  document.getElementById('nomeContato')?.value || '',
            email:    document.getElementById('emailCliente').value,
            telefone: document.getElementById('telCliente').value,
            pax:      document.getElementById('numPax').value,
        },
        evento: {
            tipo:        document.getElementById('tipoEvento').value,
            local:       document.getElementById('localEvento').value,
            dataInicio:  document.getElementById('dataInicio').value,
            montagem:    document.getElementById('dataMontagem').value,
            ensaio:      document.getElementById('dataEnsaio').value,
            desmontagem: document.getElementById('dataDesmontagem').value,
        },
        atendente: {
            nome:     document.getElementById('nomeAtendente').value,
            email:    document.getElementById('emailAtendente').value,
            telefone: document.getElementById('telAtendente').value,
        },
        financeiro: {
            totalEquip:       document.getElementById('labelTotalEquip').innerText,
            totalMaoObra:     document.getElementById('labelTotalMaoObra').innerText,
            totalDJ:          document.getElementById('labelTotalDJ')?.innerText      || 'R$ 0,00',
            totalBackdrop:    document.getElementById('labelTotalBackdrop')?.innerText || 'R$ 0,00',
            desconto:         document.getElementById('inputDesconto').value,
            totalSemNota:     document.getElementById('labelTotalSemNota').innerText,
            imposto:          document.getElementById('selectImposto').value,
            totalComImposto:  document.getElementById('labelTotalComImposto').innerText,
            taxaCartao:       document.getElementById('chkCartao')?.checked ? document.getElementById('labelTaxaCartao').innerText : 'R$ 0,00',
            totalFinal:       document.getElementById('labelTotalFinal').innerText,
        },
        salas: [],
        obs:  document.getElementById('obsGerais').value,
    };

    document.querySelectorAll('.room-wrapper').forEach(salaDiv => {
        const salaObj = { nome: salaDiv.querySelector('.room-title-input').value, categorias: [] };
        salaDiv.querySelectorAll('.item-group').forEach(catDiv => {
            const catObj = { nome: catDiv.querySelector('.category-select').value, itens: [] };
            catDiv.querySelectorAll('.item-row').forEach(row => {
                catObj.itens.push({
                    qtd:       row.querySelector('.qtd').value,
                    descricao: row.querySelector('.desc').value,
                    obs:       row.querySelector('.obs').value,
                    dias:      row.querySelector('.dias').value,
                    valor:     row.querySelector('.val').value,
                    total:     row.querySelector('.col-total').innerText,
                });
            });
            salaObj.categorias.push(catObj);
        });
        orcamento.salas.push(salaObj);
    });

    if (orcamentoEditandoId) {
        // Atualiza doc existente
        updateDoc(doc(db, "orcamentos", orcamentoEditandoId), orcamento)
            .then(() => { alert('Proposta atualizada!'); btn.innerText = txt; btn.disabled = false; })
            .catch(e => { alert('Erro ao atualizar!'); console.error(e); btn.innerText = txt; btn.disabled = false; });
    } else {
        // Cria novo doc
        addDoc(collection(db, "orcamentos"), orcamento)
            .then((docRef) => {
                orcamentoEditandoId = docRef.id;
                // Atualiza URL sem recarregar página
                window.history.replaceState({}, '', `orcamentos.html?id=${docRef.id}`);
                alert('Salvo com sucesso!');
                btn.innerText = txt; btn.disabled = false;
            })
            .catch(e => { alert('Erro ao salvar!'); console.error(e); btn.innerText = txt; btn.disabled = false; });
    }
};

/* =================================================================
   FORMATAÇÃO DE DATAS PARA IMPRESSÃO
   Converte YYYY-MM-DD → DD/MM/AAAA e salva em data-print-val
   ================================================================= */
(function() {
    const DATE_IDS = ['dataInicio', 'dataMontagem', 'dataEnsaio', 'dataDesmontagem'];

    function formatarDataBR(val) {
        if (!val) return '';
        const [y, m, d] = val.split('-');
        return d && m && y ? `${d}/${m}/${y}` : val;
    }

    function syncPrintVal(input) {
        input.setAttribute('data-print-val', formatarDataBR(input.value));
    }

    document.addEventListener('DOMContentLoaded', () => {
        DATE_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', () => syncPrintVal(el));
            syncPrintVal(el);
        });
    });

    // Também formata ao salvar no Firestore — sobrescreve os valores no objeto evento
    const _salvarOriginal = window.salvarOrcamento;
    if (typeof _salvarOriginal === 'function') {
        window.salvarOrcamento = function() {
            // Garante que data-print-val está atualizado antes de salvar
            DATE_IDS.forEach(id => {
                const el = document.getElementById(id);
                if (el) syncPrintVal(el);
            });
            _salvarOriginal();
        };
    }
})();

/* =================================================================
   CARREGAR PROPOSTA EXISTENTE (chamado quando há ?id= na URL)
   ================================================================= */
async function carregarPropostaExistente(id) {
    try {
        const snap = await getDoc(doc(db, "orcamentos", id));
        if (!snap.exists()) { alert("Proposta não encontrada."); return; }

        orcamentoEditandoId = id;
        const d = snap.data();

        // Barra de status
        const selStatus = document.getElementById('statusOrcamento');
        if (selStatus && d.status) selStatus.value = d.status;

        // Cabeçalho — proposta e data (readonly, já preenchidos por gerarNumeroProposta/hoje)
        if (d.proposta)     document.getElementById('numProposta').value    = d.proposta;
        if (d.dataProposta) document.getElementById('dataProposta').value   = d.dataProposta;

        // Atendente (readonly — vem do usuário logado, não sobrescreve)

        // Cliente
        if (d.cliente) {
            setValue('buscaCliente', d.cliente.empresa  || d.cliente.nome || '');
            setValue('nomeContato',  d.cliente.contato  || '');
            setValue('emailCliente', d.cliente.email    || '');
            setValue('telCliente',   d.cliente.telefone || '');
            setValue('numPax',       d.cliente.pax      || '');
        }

        // Evento
        if (d.evento) {
            const ev = d.evento;
            setSelect('tipoEvento',   ev.tipo        || '');
            setValue('localEvento',   ev.local       || '');
            setValue('dataInicio',    ev.dataInicio   || '');
            setValue('dataMontagem',  ev.montagem     || '');
            setValue('dataEnsaio',    ev.ensaio       || '');
            setValue('dataDesmontagem', ev.desmontagem || '');
        }

        // Financeiro
        if (d.financeiro) {
            const fin = d.financeiro;
            const descEl = document.getElementById('inputDesconto');
            if (descEl) descEl.value = fin.desconto || '0';
            const impEl = document.getElementById('selectImposto');
            if (impEl && fin.imposto) impEl.value = fin.imposto;
        }

        // Observações
        setValue('obsGerais', d.obs || '');

        // Salas — limpa container e reconstrói
        const container = document.getElementById('containerSalas');
        if (container) container.innerHTML = '';

        if (d.salas && d.salas.length > 0) {
            for (const sala of d.salas) {
                await reconstruirSala(sala);
            }
        }

        // Recalcula totais
        window.calcularTotalGeral();

        // Título da página para indicar que está editando
        document.title = `TG Pro — Proposta ${d.proposta || id}`;

    } catch (e) {
        console.error("Erro ao carregar proposta:", e);
        alert("Erro ao carregar a proposta. Verifique o console.");
    }
}

function setValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

function setSelect(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

async function reconstruirSala(salaData) {
    // Cria sala via função existente
    const id  = 'sala_' + Date.now() + Math.random();
    const div = document.createElement('div');
    div.className = 'room-wrapper';
    div.id = id;
    div.innerHTML = `
        <div class="room-header">
            <input type="text" class="room-title-input" value="${salaData.nome || 'AMBIENTE'}">
            <button class="btn-del-room no-print" onclick="this.closest('.room-wrapper').remove(); window.calcularTotalGeral()">EXCLUIR SALA</button>
        </div>
        <div class="room-content">
            <button class="btn-add-cat-to-room no-print" onclick="adicionarCategoria('${id}')">+ ADICIONAR CATEGORIA</button>
            <div class="room-categories"></div>
        </div>
        <div class="room-subtotal-bar">
            <div class="room-sub-row row-equip" style="display:none;"><span>Equipamentos:</span><strong class="room-equip-val">R$ 0,00</strong></div>
            <div class="room-sub-row row-mo" style="display:none;"><span>Mão de Obra:</span><strong class="room-mo-val">R$ 0,00</strong></div>
            <div class="room-sub-row row-dj" style="display:none;"><span>DJ:</span><strong class="room-dj-val">R$ 0,00</strong></div>
            <div class="room-sub-row row-backdrop" style="display:none;"><span>Backdrop:</span><strong class="room-backdrop-val">R$ 0,00</strong></div>
            <div class="room-sub-row row-total"><span>Subtotal do Ambiente:</span><strong class="room-total-val">R$ 0,00</strong></div>
        </div>`;
    document.getElementById('containerSalas').appendChild(div);

    // Recria categorias
    if (salaData.categorias) {
        for (const cat of salaData.categorias) {
            const idCat = 'cat_' + Date.now() + Math.random();
            const catDiv = document.createElement('div');
            catDiv.className = 'item-group';
            catDiv.id = idCat;
            catDiv.innerHTML = `
                <div class="category-header">
                    <select class="category-select" onchange="window.calcularTotalGeral()">
                        <option>SONORIZAÇÃO</option><option>ILUMINAÇÃO</option>
                        <option>ILUMINAÇÃO CÊNICA</option>
                        <option>VÍDEO / PROJEÇÃO</option><option>ESTRUTURA / BOX</option>
                        <option>PAINEL DE LED</option><option>INFORMÁTICA</option>
                        <option>MÃO DE OBRA</option><option>DJ</option>
                        <option>BACKDROP</option><option>OUTROS</option>
                    </select>
                    <button class="btn-del-item no-print" onclick="this.closest('.item-group').remove(); window.calcularTotalGeral()">×</button>
                </div>
                <div class="items-header-row grid-layout">
                    <div style="text-align:center;">QTD</div><div>DESCRIÇÃO</div>
                    <div>OBS</div><div style="text-align:center;">DIAS</div>
                    <div style="text-align:right;">UNIT.</div>
                    <div style="text-align:right;">TOTAL</div><div class="no-print"></div>
                </div>
                <div class="group-items"></div>
                <div class="no-print">
                    <button class="btn-add-item-row" onclick="adicionarItemLinha('${idCat}')">+ ADICIONAR ITEM</button>
                </div>`;
            div.querySelector('.room-categories').appendChild(catDiv);

            // Seleciona a categoria salva
            const sel = catDiv.querySelector('.category-select');
            if (sel && cat.nome) sel.value = cat.nome;

            // Recria itens
            if (cat.itens) {
                for (const item of cat.itens) {
                    const row = document.createElement('div');
                    row.className = 'item-row grid-layout';
                    row.innerHTML = `
                        <div class="col-qtd"><input type="number" class="qtd" value="${item.qtd || 1}" min="1" onchange="calcLinha(this)"></div>
                        <div class="col-desc">
                            <div class="desc-wrapper">
                                <div class="searchable-wrapper">
                                    <input type="text" class="searchable-input desc" value="${item.descricao || ''}" onkeyup="buscarItemKeyUp(this)">
                                    <div class="searchable-list"></div>
                                </div>
                                <button type="button" class="btn-search-icon no-print" onclick="window.abrirModalCatalogo(this)"><i class="fas fa-search"></i></button>
                            </div>
                        </div>
                        <div class="col-obs"><input type="text" class="obs" value="${item.obs || ''}"></div>
                        <div class="col-dias"><input type="number" class="dias" value="${item.dias || 1}" min="1" onchange="calcLinha(this)"></div>
                        <div class="col-val"><input type="text" class="val" value="${item.valor || '0,00'}" onchange="formatMoney(this); calcLinha(this)"></div>
                        <div class="col-total">${item.total || 'R$ 0,00'}</div>
                        <div class="col-action no-print">
                            <button class="btn-del-item" onclick="this.closest('.item-row').remove(); calcularTotalGeral()">×</button>
                        </div>`;
                    catDiv.querySelector('.group-items').appendChild(row);
                }
            }
        }
    }
}