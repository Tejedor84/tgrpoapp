import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- SEGURANÇA ---
import { verificarPermissao } from "./auth-guard.js";

const userEmailSpan = document.getElementById('user-email');
const btnLogout = document.getElementById('btnLogout');
const formConfig = document.getElementById('formConfig');

// Campos
const inpEmpresa = document.getElementById('confEmpresa');
const inpCNPJ = document.getElementById('confCNPJ');
const inpEndereco = document.getElementById('confEndereco');
const inpTelefone = document.getElementById('confTelefone');
const inpEmail = document.getElementById('confEmail');
const inpSite = document.getElementById('confSite');

// --- 1. INICIALIZAÇÃO SEGURA ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        if(userEmailSpan) userEmailSpan.textContent = user.email;

        // VERIFICA PERMISSÃO
        // Se não for Admin, será expulso para Dashboard (e depois para CRM se for vendas)
        await verificarPermissao(db, user.email);

        carregarConfiguracoes();
    } else {
        window.location.href = "index.html";
    }
});

if(btnLogout) {
    btnLogout.addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = "index.html");
    });
}

// --- 2. LÓGICA ---
async function carregarConfiguracoes() {
    try {
        const docRef = doc(db, "configuracoes", "geral");
        const snap = await getDoc(docRef);
        
        if (snap.exists()) {
            const d = snap.data();
            if(inpEmpresa) inpEmpresa.value = d.nomeEmpresa || "";
            if(inpCNPJ) inpCNPJ.value = d.cnpj || "";
            if(inpEndereco) inpEndereco.value = d.endereco || "";
            if(inpTelefone) inpTelefone.value = d.telefone || "";
            if(inpEmail) inpEmail.value = d.emailContato || "";
            if(inpSite) inpSite.value = d.site || "";
        }
    } catch (error) {
        console.error("Erro ao carregar configurações:", error);
    }
}

if(formConfig) {
    formConfig.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = formConfig.querySelector('button[type="submit"]');
        const txtOriginal = btn.textContent;
        btn.textContent = "Salvando...";
        btn.disabled = true;

        const dados = {
            nomeEmpresa: inpEmpresa.value,
            cnpj: inpCNPJ.value,
            endereco: inpEndereco.value,
            telefone: inpTelefone.value,
            emailContato: inpEmail.value,
            site: inpSite.value
        };

        try {
            await setDoc(doc(db, "configuracoes", "geral"), dados);
            alert("Configurações salvas com sucesso!");
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar.");
        } finally {
            btn.textContent = txtOriginal;
            btn.disabled = false;
        }
    });
}