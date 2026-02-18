/* =================================================================
   LOCAIS.JS - VERSÃO V10 COMPLETA E FUNCIONAL
   ================================================================= */

import { db } from './firebase-init.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    doc, 
    query, 
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    console.log("Sistema de Locais Iniciado.");
    listarLocais();
    
    // Configura fechar modal ao clicar fora
    const modal = document.getElementById('modalLocal');
    window.onclick = function(event) {
        if (event.target == modal) {
            fecharModal();
        }
    }
});

/* =================================================================
   FUNÇÕES DE MODAL (Essenciais para o botão funcionar)
   ================================================================= */

window.abrirModal = function() {
    const modal = document.getElementById('modalLocal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'block'; // Garante que apareça
        
        // Foca no primeiro campo
        setTimeout(() => {
            const input = document.getElementById('nomeLocal');
            if(input) input.focus();
        }, 100);
    } else {
        console.error("Erro: Modal com id 'modalLocal' não encontrado no HTML.");
    }
}

window.fecharModal = function() {
    const modal = document.getElementById('modalLocal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        
        // Limpa formulário ao fechar
        const form = document.getElementById('formLocal');
        if(form) form.reset();
    }
}

/* =================================================================
   FUNÇÕES DE BANCO DE DADOS
   ================================================================= */

// 1. SALVAR NOVO LOCAL
window.salvarLocal = async function(event) {
    // Evita recarregar a página se for chamado por um form submit
    if(event) event.preventDefault();

    const nomeInput = document.getElementById('nomeLocal');
    const endInput = document.getElementById('enderecoLocal');
    const obsInput = document.getElementById('obsLocal');
    
    const nome = nomeInput.value.trim();
    const endereco = endInput ? endInput.value.trim() : "";
    const obs = obsInput ? obsInput.value.trim() : "";

    if (!nome) {
        alert("Por favor, digite o nome do local.");
        return;
    }

    const btnSalvar = document.getElementById('btnSalvar') || document.querySelector('button[type="submit"]');
    const txtOriginal = btnSalvar ? btnSalvar.innerText : "Salvar";
    
    if (btnSalvar) {
        btnSalvar.innerText = "Salvando...";
        btnSalvar.disabled = true;
    }

    try {
        await addDoc(collection(db, "locais"), {
            nome: nome,
            endereco: endereco,
            obs: obs,
            dataCriacao: serverTimestamp()
        });
        
        alert("Local salvo com sucesso!");
        window.fecharModal();
        listarLocais(); // Atualiza a lista

    } catch (error) {
        console.error("Erro ao salvar local:", error);
        alert("Erro ao salvar: " + error.message);
    } finally {
        if (btnSalvar) {
            btnSalvar.innerText = txtOriginal;
            btnSalvar.disabled = false;
        }
    }
}

// 2. LISTAR LOCAIS
async function listarLocais() {
    const lista = document.getElementById('lista-locais');
    if (!lista) return;

    lista.innerHTML = '<tr><td colspan="4" style="text-align:center;">Carregando...</td></tr>';

    try {
        const q = query(collection(db, "locais"), orderBy("nome"));
        const querySnapshot = await getDocs(q);
        
        lista.innerHTML = '';
        
        if (querySnapshot.empty) {
            lista.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhum local cadastrado.</td></tr>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const local = doc.data();
            const tr = document.createElement('tr');
            
            tr.innerHTML = `
                <td><strong>${local.nome || 'Sem nome'}</strong></td>
                <td>${local.endereco || '-'}</td>
                <td>${local.obs || '-'}</td>
                <td style="text-align:center;">
                    <button class="btn-delete" onclick="excluirLocal('${doc.id}')" style="cursor:pointer; border:none; background:transparent; font-size:1.2em;" title="Excluir">
                        🗑️
                    </button>
                </td>
            `;
            lista.appendChild(tr);
        });

    } catch (error) {
        console.error("Erro ao listar:", error);
        lista.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Erro ao carregar dados. Verifique o console.</td></tr>';
    }
}

// 3. EXCLUIR LOCAL
window.excluirLocal = async function(id) {
    if (confirm("Tem certeza que deseja excluir este local?")) {
        try {
            await deleteDoc(doc(db, "locais", id));
            listarLocais(); // Atualiza a tabela
        } catch (error) {
            console.error("Erro ao excluir:", error);
            alert("Erro ao excluir: " + error.message);
        }
    }
}