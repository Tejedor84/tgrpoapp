import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const txtRelogio = document.getElementById('txtRelogio');
const txtData    = document.getElementById('txtData');
const txtUsuario = document.getElementById('txtUsuario');
const msgGPS     = document.getElementById('msgGPS');

const btnEntrada     = document.getElementById('btnEntrada');
const btnAlmocoIda   = document.getElementById('btnAlmocoIda');
const btnAlmocoVolta = document.getElementById('btnAlmocoVolta');
const btnSaida       = document.getElementById('btnSaida');

let localizacaoAtual = null;
let usuarioLogado    = null;

// 1. Relógio em tempo real
setInterval(() => {
    const now = new Date();
    txtRelogio.textContent = now.toLocaleTimeString('pt-BR');
    txtData.textContent = now.toLocaleDateString('pt-BR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}, 1000);

// 2. Captura GPS
function capturarGPS() {
    return new Promise((resolve, reject) => {
        if (!('geolocation' in navigator)) {
            msgGPS.innerHTML = "❌ GPS não suportado neste navegador";
            return reject("Não suportado");
        }

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
                msgGPS.innerHTML = "❌ Ative o GPS para bater o ponto";
                msgGPS.style.color = "#ff4d4d";
                alert("Atenção: você precisa permitir o acesso à localização para usar o ponto.");
                reject(err);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}

// 3. Autenticação
onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioLogado = user;
        txtUsuario.textContent = `Funcionário: ${user.email}`;
        desabilitarTodos();
        try {
            await capturarGPS();
            await verificarDia();
        } catch (e) {
            console.error("Erro inicial:", e);
        }
    } else {
        window.location.href = "index.html";
    }
});

// 4. Ativa/desativa botões conforme o estado do dia
function desabilitarTodos() {
    [btnEntrada, btnAlmocoIda, btnAlmocoVolta, btnSaida].forEach(b => b.disabled = true);
}

async function verificarDia() {
    const dataStr = new Date().toISOString().split('T')[0];
    const snap = await getDoc(doc(db, "registros_ponto", `${usuarioLogado.uid}_${dataStr}`));

    desabilitarTodos();

    if (!snap.exists()) {
        btnEntrada.disabled = false;
        return;
    }

    const d = snap.data();
    if      (!d.entrada)      btnEntrada.disabled = false;
    else if (!d.saida_almoco) btnAlmocoIda.disabled = false;
    else if (!d.volta_almoco) btnAlmocoVolta.disabled = false;
    else if (!d.saida)        btnSaida.disabled = false;
    else {
        msgGPS.innerHTML = "✨ Todos os pontos de hoje já foram registrados.";
        msgGPS.style.color = "#FFD700";
    }
}

// 5. Registrar ponto
async function registrarPonto(tipo) {
    try {
        await capturarGPS();

        if (!localizacaoAtual) {
            alert("Erro de localização. Tente novamente.");
            return;
        }

        const labels = {
            entrada: 'ENTRADA',
            almocoIda: 'ALMOÇO (IDA)',
            almocoVolta: 'ALMOÇO (VOLTA)',
            saida: 'SAÍDA'
        };

        if (!confirm(`Confirmar registro de ${labels[tipo]} agora?`)) return;

        const agora   = new Date();
        const dataStr = agora.toISOString().split('T')[0];
        const horaStr = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const docId   = `${usuarioLogado.uid}_${dataStr}`;

        const dados = {
            funcionarioId:    usuarioLogado.uid,
            emailFuncionario: usuarioLogado.email,
            data:             dataStr,
            tipo:             "Trabalho",
            [`loc_${tipo}`]:       localizacaoAtual,
            [`timestamp_${tipo}`]: serverTimestamp()
        };

        if (tipo === 'entrada')      dados.entrada      = horaStr;
        if (tipo === 'almocoIda')    dados.saida_almoco = horaStr;
        if (tipo === 'almocoVolta')  dados.volta_almoco = horaStr;
        if (tipo === 'saida')        dados.saida        = horaStr;

        await setDoc(doc(db, "registros_ponto", docId), dados, { merge: true });

        alert(`✅ ${labels[tipo]} registrado às ${horaStr}`);
        await verificarDia();

    } catch (e) {
        alert("Erro ao registrar: " + e.message);
    }
}

// 6. Vincular botões dentro do DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    btnEntrada.addEventListener('click',     () => registrarPonto('entrada'));
    btnAlmocoIda.addEventListener('click',   () => registrarPonto('almocoIda'));
    btnAlmocoVolta.addEventListener('click', () => registrarPonto('almocoVolta'));
    btnSaida.addEventListener('click',       () => registrarPonto('saida'));
});