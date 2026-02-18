import { auth, db } from "./firebase-init.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Função principal de verificação
export async function verificarPermissao(db, email) {
    if (!email) return false;

    try {
        // Verifica primeiro na coleção 'equipe'
        const docRef = doc(db, "equipe", email);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            // Se tiver status e não for ativo, bloqueia
            if (data.status && data.status !== "Ativo") {
                alert("Seu acesso está inativo. Contate o administrador.");
                auth.signOut();
                return false;
            }
            return true;
        }
        
        // Se não achou em equipe, deixa passar (ou implemente lógica para 'usuarios')
        return true;

    } catch (error) {
        console.error("Erro ao verificar permissão:", error);
        return true; // Em caso de erro de rede, não bloqueia o trabalho
    }
}