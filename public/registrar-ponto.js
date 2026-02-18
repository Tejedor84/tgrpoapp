import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const txtRelogio = document.getElementById('txtRelogio');
const txtData = document.getElementById('txtData');
const txtUsuario = document.getElementById('txtUsuario');
const msgGPS = document.getElementById('msgGPS');

const btnEntrada = document.getElementById('btnEntrada');
const btnAlmocoIda = document.getElementById('btnAlmocoIda');
const btnAlmocoVolta = document.getElementById('btnAlmocoVolta');
const btnSaida = document.getElementById('btnSaida');

let localizacaoAtual = null;
let usuarioLogado = null;

// 1. Atualização do Relógio
setInterval(() => {
    const now = new Date();
    txtRelogio.textContent = now.toLocaleTimeString('pt-BR');
    txtData.textContent = now.toLocaleDateString('pt-BR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}, 1000);

// 2. Captura de GPS Obrigatória
function capturarGPS() {
    return new Promise((resolve, reject) => {
        if ("geolocation" in navigator) {
            msgGPS.innerHTML = "🛰️ Localizando...";
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    localizacaoAtual = { 
                        lat: pos.coords.latitude, 
                        lon: pos.coords.longitude,
                        precisao: pos.coords.accuracy
                    };
                    msgGPS.innerHTML = "✅ Localização capturada com sucesso";
                    msgGPS.style.color = "#00e676";
                    resolve(localizacaoAtual);
                },
                (err) => {
                    msgGPS.innerHTML = "❌ Erro: Ative o GPS para bater o ponto";
                    msgGPS.style.color = "#ff4d4d";
                    alert("Atenção: Você precisa permitir o acesso à localização para usar o ponto.");
                    reject(err);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            msgGPS.innerHTML = "❌ GPS não suportado neste navegador";
            reject("Não suportado");
        }
    });
}

// 3. Verificação de Estado Inicial
onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioLogado = user;
        txtUsuario.textContent = `Funcionário: ${user.email}`;
        
        // Desabilita tudo até carregar os dados e o GPS
        desabilitarTodosBotoes();
        
        try {
            await capturarGPS();
            await verificarRegistrosDoDia();
        } catch (e) {
            console.error("Erro inicial:", e);
        }
    } else {
        window.location.href = "index.html";
    }
});

function desabilitarTodosBotoes() {
    btnEntrada.disabled = true;
    btnAlmocoIda.disabled = true;
    btnAlmocoVolta.disabled = true;
    btnSaida.disabled = true;
}

// 4. Lógica de Bloqueio/Ativação de Botões
async function verificarRegistrosDoDia() {
    const dataStr = new Date().toISOString().split('T')[0];
    const docRef = doc(db, "registros_ponto", `${usuarioLogado.uid}_${dataStr}`);
    const snap = await getDoc(docRef);
    
    // Reseta estados
    desabilitarTodosBotoes();

    if (!snap.exists()) {
        // Nada batido hoje: libera apenas entrada
        btnEntrada.disabled = false;
    } else {
        const d = snap.data();
        
        // Sequência lógica: Entrada -> Almoço Ida -> Almoço Volta -> Saída
        if (!d.entrada) {
            btnEntrada.disabled = false;
        } else if (!d.saida_almoco) {
            btnAlmocoIda.disabled = false;
        } else if (!d.volta_almoco) {
            btnAlmocoVolta.disabled = false;
        } else if (!d.saida) {
            btnSaida.disabled = false;
        } else {
            msgGPS.innerHTML = "✨ Todos os pontos de hoje já foram registrados.";
            msgGPS.style.color = "#FFD700";
        }
    }
}

// 5. Função para Bater o Ponto
async function registrarPonto(tipo) {
    try {
        // Força nova captura de GPS no momento do clique
        await capturarGPS();
        
        if (!localizacaoAtual) {
            alert("Erro de localização. Tente novamente.");
            return;
        }

        const confirmacao = confirm(`Confirmar registro de ${tipo.toUpperCase()} agora?`);
        if (!confirmacao) return;

        const agora = new Date();
        const dataStr = agora.toISOString().split('T')[0];
        const horaStr = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const docId = `${usuarioLogado.uid}_${dataStr}`;

        const pontoRef = doc(db, "registros_ponto", docId);
        
        const dados = {
            funcionarioId: usuarioLogado.uid,
            emailFuncionario: usuarioLogado.email,
            data: dataStr,
            tipo: "Trabalho",
            [`loc_${tipo}`]: localizacaoAtual,
            [`timestamp_${tipo}`]: serverTimestamp()
        };

        // Adiciona a hora no campo correspondente
        if (tipo === 'entrada') dados.entrada = horaStr;
        if (tipo === 'almocoIda') dados.saida_almoco = horaStr;
        if (tipo === 'almocoVolta') dados.volta_almoco = horaStr;
        if (tipo === 'saida') dados.saida = horaStr;

        await setDoc(pontoRef, dados, { merge: true });
        
        alert(`Sucesso! ${tipo.replace('almoco', 'almoço')} registrado às ${horaStr}`);
        await verificarRegistrosDoDia(); // Atualiza botões sem recarregar a página
        
    } catch (e) {
        alert("Erro ao registrar: " + e.message);
    }
}

// 6. Vinculação de Eventos
btnEntrada.onclick = () => registrarPonto('entrada');
btnAlmocoIda.onclick = () => registrarPonto('almocoIda');
btnAlmocoVolta.onclick = () => registrarPonto('almocoVolta');
btnSaida.onclick = () => registrarPonto('saida');