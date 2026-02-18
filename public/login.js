import { auth, db } from "./firebase-init.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const form = document.getElementById('authForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnSubmit = document.getElementById('btnSubmit');
const msgError = document.getElementById('msgError');
const msgSuccess = document.getElementById('msgSuccess');
const toggleText = document.getElementById('toggleText');
const formTitle = document.getElementById('formTitle');

let isLoginMode = true; // true = Login, false = Criar Senha

console.log("Sistema de Login Iniciado.");

// 1. ALTERNAR ENTRE LOGIN E CADASTRO
toggleText.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    msgError.style.display = 'none';
    msgSuccess.style.display = 'none';
    
    if (isLoginMode) {
        formTitle.textContent = "Login";
        btnSubmit.textContent = "Entrar";
        toggleText.innerHTML = "Primeiro acesso? <strong>Criar minha senha</strong>";
    } else {
        formTitle.textContent = "Primeiro Acesso";
        btnSubmit.textContent = "Definir Senha e Entrar";
        toggleText.innerHTML = "Já tenho conta. <strong>Fazer Login</strong>";
    }
    console.log("Modo alterado. LoginMode:", isLoginMode);
});

// 2. ENVIAR FORMULÁRIO
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    msgError.style.display = 'none';
    msgSuccess.style.display = 'none';
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Processando...";

    try {
        if (isLoginMode) {
            // --- MODO LOGIN ---
            console.log("Tentando logar...");
            await signInWithEmailAndPassword(auth, email, password);
            console.log("Login sucesso. Redirecionando...");
            window.location.href = "painel.html";

        } else {
            // --- MODO PRIMEIRO ACESSO ---
            console.log("Tentando criar conta...");
            
            // VERIFICAÇÃO DE SEGURANÇA
            // O usuário precisa ler o banco para ver se o email dele está lá.
            // Se as regras do Firebase bloquearem leitura pública, isso vai falhar aqui.
            const q = query(collection(db, "usuarios_permissoes"), where("email", "==", email));
            
            let snapshot;
            try {
                snapshot = await getDocs(q);
            } catch (firestoreError) {
                console.error("Erro de Permissão no Firestore:", firestoreError);
                throw new Error("Erro de conexão. O sistema não conseguiu verificar seu e-mail. (Verifique Regras do Firestore)");
            }

            if (snapshot.empty) {
                throw new Error("Este e-mail não foi liberado pelo administrador. Peça seu cadastro primeiro.");
            }

            // Se passou, cria a conta
            await createUserWithEmailAndPassword(auth, email, password);
            
            msgSuccess.textContent = "Senha criada! Entrando...";
            msgSuccess.style.display = 'block';
            setTimeout(() => window.location.href = "painel.html", 1500);
        }

    } catch (error) {
        console.error("Erro geral:", error);
        msgError.style.display = 'block';

        if (error.code === 'auth/email-already-in-use') {
            msgError.textContent = "Este e-mail já possui senha. Faça login.";
        } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            msgError.textContent = "E-mail ou senha incorretos.";
        } else if (error.code === 'auth/weak-password') {
            msgError.textContent = "A senha deve ter no mínimo 6 caracteres.";
        } else if (error.code === 'permission-denied') {
            msgError.textContent = "Acesso negado ao banco de dados.";
        } else {
            msgError.textContent = error.message;
        }
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = isLoginMode ? "Entrar" : "Definir Senha e Entrar";
    }
});