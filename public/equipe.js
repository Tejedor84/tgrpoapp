import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ELEMENTOS ---
const grid = document.getElementById('equipeGrid');
const modal = document.getElementById('modalMember');
const form = document.getElementById('formMember');

const inpName = document.getElementById('inpName');
const inpRole = document.getElementById('inpRole');
const inpPhone = document.getElementById('inpPhone');
const inpEmailMember = document.getElementById('inpEmailMember');
const inpBankInfo = document.getElementById('inpBankInfo');
const memberIdField = document.getElementById('memberId');

// Avaliação
const reviewsSection = document.getElementById('reviewsSection');
const reviewsList = document.getElementById('reviewsList');
const inpReviewComment = document.getElementById('inpReviewComment');
const btnSaveReview = document.getElementById('btnSaveReview');
const starInputs = document.getElementsByName('rating');

// Estado
let currentUserEmail = "";
let currentMemberData = null; // Dados do membro sendo editado

// --- 1. INICIALIZAÇÃO ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserEmail = user.email;
        carregarEquipe();
    } else {
        window.location.href = "index.html";
    }
});

// --- 2. CARREGAR EQUIPE (REALTIME) ---
function carregarEquipe() {
    // Escuta mudanças na coleção 'equipe'
    onSnapshot(collection(db, "equipe"), (snapshot) => {
        grid.innerHTML = "";
        
        if (snapshot.empty) {
            grid.innerHTML = '<p style="color:#666;">Nenhum colaborador cadastrado.</p>';
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;

            // Calcula Média
            let media = 0;
            let qtd = 0;
            if (data.avaliacoes && data.avaliacoes.length > 0) {
                const soma = data.avaliacoes.reduce((acc, curr) => acc + parseInt(curr.nota), 0);
                qtd = data.avaliacoes.length;
                media = (soma / qtd).toFixed(1);
            }

            // Renderiza Cartão
            const card = document.createElement('div');
            card.className = 'member-card';
            card.innerHTML = `
                <div class="member-header">
                    <div>
                        <h3 class="member-name">${data.nome}</h3>
                        <div class="member-role">${data.cargo}</div>
                    </div>
                    <div class="rating-badge" title="${qtd} avaliações">
                        ⭐ ${media > 0 ? media : '-'}
                    </div>
                </div>

                <div class="member-details">
                    <p>📞 ${data.telefone || "---"}</p>
                    <p>📧 ${data.email || "---"}</p>
                </div>

                <div class="member-actions">
                    <button class="btn-icon" onclick="editarMembro('${id}')">✏️ Editar / Avaliar</button>
                    <button class="btn-icon" onclick="excluirMembro('${id}')" style="color:#ff4d4d;">🗑️</button>
                </div>
            `;
            grid.appendChild(card);
        });
    });
}

// --- 3. CRUD MEMBRO ---
document.getElementById('btnAddMember').addEventListener('click', () => {
    form.reset();
    memberIdField.value = "";
    reviewsSection.style.display = 'none'; // Esconde review no cadastro
    document.getElementById('modalTitle').textContent = "Novo Colaborador";
    modal.classList.remove('hidden');
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const dados = {
        nome: inpName.value,
        cargo: inpRole.value,
        telefone: inpPhone.value,
        email: inpEmailMember.value,
        dadosBancarios: inpBankInfo.value
        // avaliacoes: mantem o que já existe (firestore merge update ou addDoc cria array vazio se não passar?)
        // Na atualização o updateDoc só altera os campos passados.
    };

    const id = memberIdField.value;

    try {
        if (id) {
            await updateDoc(doc(db, "equipe", id), dados);
        } else {
            // Novo: inicializa array de avaliações vazio
            dados.avaliacoes = [];
            await addDoc(collection(db, "equipe"), dados);
        }
        modal.classList.add('hidden');
    } catch (error) {
        alert("Erro ao salvar: " + error.message);
    }
});

// --- 4. EDITAR E AVALIAR ---
// Precisa ser global para o HTML chamar
window.editarMembro = async (id) => {
    // Busca dados no DOM ou Banco? Melhor Banco ou cache.
    // Como estamos usando onSnapshot, não temos array global fácil. Vamos buscar doc rápido.
    // Ou melhor: criar array global 'equipeCache' no onSnapshot (mais otimizado).
    // Vou usar getDoc direto aqui pela simplicidade.
    
    const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const docSnap = await getDoc(doc(db, "equipe", id));

    if (docSnap.exists()) {
        const data = docSnap.data();
        currentMemberData = { id: docSnap.id, ...data };

        // Preenche Form
        memberIdField.value = id;
        inpName.value = data.nome;
        inpRole.value = data.cargo;
        inpPhone.value = data.telefone;
        inpEmailMember.value = data.email;
        inpBankInfo.value = data.dadosBancarios;

        // Preenche Reviews
        renderizarReviews(data.avaliacoes || []);

        // Mostra seção de avaliação
        reviewsSection.style.display = 'block';
        document.getElementById('modalTitle').textContent = "Editar / Avaliar";
        modal.classList.remove('hidden');
    }
};

function renderizarReviews(lista) {
    reviewsList.innerHTML = "";
    if (lista.length === 0) {
        reviewsList.innerHTML = "<p style='color:#666; font-size:0.9em;'>Nenhuma avaliação ainda.</p>";
        return;
    }

    // Inverte para mostrar as mais recentes no topo (se o array for pushado sequencialmente)
    // O ideal seria ordenar por data, mas array simples serve.
    [...lista].reverse().forEach(rev => {
        const div = document.createElement('div');
        div.className = "review-item";
        div.innerHTML = `
            <div class="review-header">
                <strong>⭐ ${rev.nota}/5</strong>
                <span>${rev.autor} - ${new Date(rev.data).toLocaleDateString()}</span>
            </div>
            <div class="review-text">"${rev.comentario}"</div>
        `;
        reviewsList.appendChild(div);
    });
}

// --- 5. SALVAR NOVA AVALIAÇÃO ---
btnSaveReview.addEventListener('click', async (e) => {
    e.preventDefault(); // Evita submit do form principal

    const id = memberIdField.value;
    if (!id) return;

    // Pega valor das estrelas
    let notaSelecionada = 0;
    for (const radio of starInputs) {
        if (radio.checked) {
            notaSelecionada = radio.value;
            break;
        }
    }

    if (notaSelecionada === 0) return alert("Selecione de 1 a 5 estrelas.");
    
    const comentario = inpReviewComment.value.trim();
    if (!comentario) return alert("Escreva uma justificativa.");

    const novaAvaliacao = {
        nota: parseInt(notaSelecionada),
        comentario: comentario,
        autor: currentUserEmail,
        data: new Date().toISOString()
    };

    try {
        await updateDoc(doc(db, "equipe", id), {
            avaliacoes: arrayUnion(novaAvaliacao)
        });
        
        // Limpa campos
        inpReviewComment.value = "";
        for (const radio of starInputs) radio.checked = false;
        
        // Atualiza lista visualmente (busca novo dado ou insere manual)
        // Vamos inserir manual para feedback rápido
        const listaAtualizada = currentMemberData.avaliacoes || [];
        listaAtualizada.push(novaAvaliacao);
        renderizarReviews(listaAtualizada);
        
        alert("Avaliação registrada!");
    } catch (error) {
        console.error(error);
        alert("Erro ao avaliar.");
    }
});

// --- 6. EXCLUIR ---
window.excluirMembro = async (id) => {
    if(confirm("Remover este colaborador?")) {
        await deleteDoc(doc(db, "equipe", id));
    }
};

// Modal Controls
document.getElementById('btnCancel').addEventListener('click', () => modal.classList.add('hidden'));
document.getElementById('closeModal').addEventListener('click', () => modal.classList.add('hidden'));