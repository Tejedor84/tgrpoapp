import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const userEmailSpan = document.getElementById('userEmail');
const userRoleBadge = document.getElementById('userRoleBadge');
const loadingOverlay = document.getElementById('loadingOverlay');
const msgNoAccess = document.getElementById('msgNoAccess');

// MAPEAMENTO GRANULAR
// Chave: ID do elemento HTML
// Valor: Nome da permissão salva no banco de dados (usuarios.js)
const mapaPermissoes = {
    // Geral
    'btnDashboard': 'dashboard',
    'btnCronograma': 'cronograma',
    
    // Operacional
    'btnEventos': 'eventos',
    'btnLocais': 'locais',
    'btnEquipamentos': 'equipamentos',
    
    // RH
    'btnPonto': 'ponto',
    'btnEquipe': 'equipe',
    'btnRelatorioPonto': 'relatorio_ponto',

    // Comercial
    'btnClientes': 'clientes',
    'btnOrcamentos': 'orcamentos',
    'btnCRM': 'crm',

    // Financeiro
    'btnPagamentos': 'pagamentos',
    'btnPendencias': 'pendencias',

    // Admin (Sempre restrito)
    'btnUsuarios': 'admin',
    'btnConfig': 'admin'
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        userEmailSpan.textContent = user.email;
        await aplicarPermissoes(user.email);
    } else {
        window.location.href = "index.html";
    }
});

async function aplicarPermissoes(email) {
    try {
        const q = query(collection(db, "usuarios_permissoes"), where("email", "==", email));
        const snapshot = await getDocs(q);

        let permissoes = [];
        let isAdmin = false;
        let usuarioEncontrado = false;

        if (!snapshot.empty) {
            const dados = snapshot.docs[0].data();
            isAdmin = dados.admin === true;
            permissoes = dados.permissoes || [];
            usuarioEncontrado = true;
        } else {
            console.warn("Usuário logado sem registro de permissões no banco.");
            // Se não achou, assume tudo bloqueado (isAdmin false, permissoes [])
        }

        // Atualiza visual do Badge
        if (isAdmin) {
            userRoleBadge.textContent = "Administrador";
            userRoleBadge.className = "role-badge badge-admin";
        } else {
            userRoleBadge.textContent = "Colaborador";
            userRoleBadge.className = "role-badge badge-user";
        }

        // LÓGICA DE EXIBIÇÃO DOS BOTÕES
        let algumBotaoVisivel = false;

        for (const [btnId, permNecessaria] of Object.entries(mapaPermissoes)) {
            const elemento = document.getElementById(btnId);
            
            // Se o botão não existe no HTML (por erro de digitação ou remoção), ignora
            if (!elemento) continue;

            // 1. Se for Admin, mostra tudo
            if (isAdmin) {
                elemento.style.display = "flex";
                algumBotaoVisivel = true;
                continue;
            }

            // 2. Se a permissão necessária for 'admin' e o usuário NÃO é admin, esconde
            if (permNecessaria === 'admin') {
                elemento.style.display = "none";
                continue;
            }

            // 3. Verifica se a permissão está na lista do usuário
            if (permissoes.includes(permNecessaria)) {
                elemento.style.display = "flex";
                algumBotaoVisivel = true;
            } else {
                elemento.style.display = "none";
            }
        }

        // Se nenhum botão ficou visível, mostra a mensagem de bloqueio
        if (!algumBotaoVisivel) {
            if (msgNoAccess) msgNoAccess.style.display = "block";
        } else {
            if (msgNoAccess) msgNoAccess.style.display = "none";
        }
        
        // Remove tela de carregamento
        loadingOverlay.style.display = "none";

    } catch (error) {
        console.error("Erro crítico ao aplicar permissões:", error);
        alert("Erro de conexão ao validar permissões. Tente recarregar.");
        loadingOverlay.style.display = "none";
    }
}

// Logout
document.getElementById('btnLogout').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");
});

// Navegação Global
window.irPara = (url) => {
    window.location.href = url;
};