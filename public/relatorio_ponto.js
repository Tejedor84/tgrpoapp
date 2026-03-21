/* =================================================================
   RELATORIO_PONTO.JS - CONECTADO EM 'PONTO' E 'EQUIPE'
   ================================================================= */

import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let colaboradoresCache = []; // Para guardar os nomes rápidos

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    document.getElementById('filterMonth').value = `${ano}-${mes}`;

    carregarColaboradores();
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('user-email').textContent = user.email;
    } else {
        window.location.href = "index.html";
    }
});

/* =================================================================
   CARREGAR COLABORADORES (COLEÇÃO 'EQUIPE')
   ================================================================= */
async function carregarColaboradores() {
    const select = document.getElementById('filterEmployee');
    if (!select) return;

    try {
        const q = query(collection(db, "equipe"), orderBy("nome"));
        const snap = await getDocs(q);
        
        colaboradoresCache = [];

        snap.forEach(doc => {
            const data = doc.data();
            const email = data.email || doc.id;
            const nome = data.nome || "Sem Nome";
            
            // Salva na memória para usar na tabela depois
            colaboradoresCache.push({ email: email, nome: nome });

            const option = document.createElement('option');
            option.value = email;
            option.textContent = nome;
            select.appendChild(option);
        });

    } catch (e) {
        console.error("Erro ao carregar colaboradores:", e);
    }
}

/* =================================================================
   CÁLCULOS MATEMÁTICOS DE HORAS
   ================================================================= */
function calcularMinutos(horaInicio, horaFim) {
    if (!horaInicio || !horaFim) return 0;
    
    const [h1, m1] = horaInicio.split(':').map(Number);
    const [h2, m2] = horaFim.split(':').map(Number);
    
    if(isNaN(h1) || isNaN(h2)) return 0;

    const min1 = (h1 * 60) + m1;
    const min2 = (h2 * 60) + m2;
    
    let diff = min2 - min1;
    if (diff < 0) diff += (24 * 60); // Caso passou da meia noite
    
    return diff;
}

function formatarTempo(minutosTotais) {
    const h = Math.floor(minutosTotais / 60);
    const m = minutosTotais % 60;
    return `${h}h ${m}m`;
}

/* =================================================================
   GERAÇÃO DO RELATÓRIO (COLEÇÃO 'PONTO')
   ================================================================= */
window.gerarRelatorio = async function() {
    const tbody = document.getElementById('lista-relatorio');
    const tfoot = document.getElementById('rodape-relatorio');
    const mesAno = document.getElementById('filterMonth').value; 
    const emailSelecionado = document.getElementById('filterEmployee').value;
    
    if (!mesAno) {
        alert("Por favor, selecione o Mês/Ano.");
        return;
    }

    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Buscando registros... Aguarde.</td></tr>';
    tfoot.style.display = 'none';

    document.getElementById('print-info').innerText = `Período: ${mesAno.split('-')[1]}/${mesAno.split('-')[0]}`;

    try {
        // Busca da coleção PONTO
        const q = query(collection(db, "ponto"), orderBy("data", "asc"));
        const snap = await getDocs(q);

        tbody.innerHTML = '';
        let minutosGeraisTrabalhados = 0;
        let registrosEncontrados = 0;

        snap.forEach(doc => {
            const dado = doc.data();
            
            // FILTRO 1: Pelo Mês
            if (!dado.data || !dado.data.startsWith(mesAno)) return;
            
            // FILTRO 2: Pela Seleção do Dropdown
            const funcEmail = dado.usuarioEmail || '';
            if (emailSelecionado && funcEmail !== emailSelecionado) return;

            registrosEncontrados++;

            // CALCULAR HORAS (Entrada até Saída)
            let minutosDia = 0;
            if (dado.entrada && dado.saida && dado.status === "Trabalho") {
                minutosDia = calcularMinutos(dado.entrada, dado.saida);
            }
            minutosGeraisTrabalhados += minutosDia;

            // Busca o nome do colaborador
            const colabEncontrado = colaboradoresCache.find(c => c.email === funcEmail);
            const nomeExibicao = colabEncontrado ? colabEncontrado.nome : (funcEmail || 'Desconhecido');

            // Formata a data (YYYY-MM-DD para DD/MM/YYYY)
            const dataFormatada = dado.data.split('-').reverse().join('/');

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${dataFormatada}</strong></td>
                <td>${nomeExibicao}</td>
                <td><span class="status-badge" style="background: rgba(255,215,0,0.1); padding: 3px 8px; border-radius: 4px; font-size: 0.85rem; color: var(--primary-color);">${dado.status || 'Trabalho'}</span></td>
                <td>${dado.entrada || '--:--'}</td>
                <td>${dado.saida || '--:--'}</td>
                <td style="text-align: right; color: var(--primary-color); font-weight: bold;">
                    ${minutosDia > 0 ? formatarTempo(minutosDia) : '-'}
                </td>
                <td>${dado.observacoes || '-'}</td>
            `;
            tbody.appendChild(tr);
        });

        if (registrosEncontrados === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhum registro encontrado para este filtro.</td></tr>';
        } else {
            document.getElementById('totalGeralHoras').innerText = formatarTempo(minutosGeraisTrabalhados);
            tfoot.style.display = 'table-row-group';
        }

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Erro ao buscar dados: ${e.message}</td></tr>`;
    }
}