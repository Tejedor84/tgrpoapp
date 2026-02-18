import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Elementos
const userEmailSpan = document.getElementById('userEmail');
const countPendencias = document.getElementById('countPendencias');
const countEventos = document.getElementById('countEventos');
const eventList = document.getElementById('eventList');

const weatherCity = document.getElementById('weatherCity');
const weatherTemp = document.getElementById('weatherTemp');
const weatherDesc = document.getElementById('weatherDesc');
const systemVersion = document.getElementById('systemVersion');

// --- 1. INICIALIZAÇÃO ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        userEmailSpan.textContent = user.email;
        carregarKPIs();
        carregarProximosEventos();
        carregarVersao();
    } else {
        window.location.href = "index.html";
    }
});

// --- 2. CARREGAR PENDÊNCIAS E CONTAGEM EVENTOS ---
async function carregarKPIs() {
    try {
        // PENDÊNCIAS (Não resolvidas)
        const qPend = query(collection(db, "pendencias"), where("status", "==", "pendente"));
        const snapPend = await getDocs(qPend);
        countPendencias.textContent = snapPend.size;

        // EVENTOS FUTUROS (Contagem)
        const hoje = new Date().toISOString().split('T')[0];
        const qEvent = query(collection(db, "eventos"), where("dataInicio", ">=", hoje));
        const snapEvent = await getDocs(qEvent);
        countEventos.textContent = snapEvent.size;

    } catch (error) {
        console.error("Erro ao carregar KPIs:", error);
    }
}

// --- 3. CARREGAR PRÓXIMOS EVENTOS E CLIMA ---
async function carregarProximosEventos() {
    try {
        const hoje = new Date().toISOString().split('T')[0];
        
        // Busca os 5 próximos eventos
        const q = query(
            collection(db, "eventos"), 
            where("dataInicio", ">=", hoje),
            orderBy("dataInicio", "asc"),
            limit(5)
        );
        
        const snapshot = await getDocs(q);
        eventList.innerHTML = "";

        if (snapshot.empty) {
            eventList.innerHTML = '<li class="loading-item">Nenhum evento próximo.</li>';
            buscarClima("São Paulo"); // Padrão se não tiver evento
            return;
        }

        let cidadeParaClima = null;

        snapshot.forEach((doc, index) => {
            const data = doc.data();
            
            // Pega a cidade do primeiro evento para o widget de clima
            if (index === 0 && data.local) {
                // Tenta extrair cidade simples (ex: "São Paulo - SP" -> "São Paulo")
                // Assume que o usuário digita algo como "Espaço X - Cidade"
                // Se não achar hífen, usa o local todo.
                cidadeParaClima = data.local.split('-')[1]?.trim() || data.local;
            }

            // Formata data
            const diaMes = data.dataInicio.split('-').reverse().slice(0, 2).join('/');
            
            const li = document.createElement('li');
            li.className = 'event-item';
            li.innerHTML = `
                <div class="event-details">
                    <strong>${data.nome}</strong>
                    <span>📍 ${data.local || "Local a definir"}</span>
                </div>
                <div class="event-date">${diaMes}</div>
            `;
            eventList.appendChild(li);
        });

        // Chama o Clima
        buscarClima(cidadeParaClima || "São Paulo");

    } catch (error) {
        console.error("Erro na agenda:", error);
        eventList.innerHTML = '<li class="loading-item" style="color:red">Erro ao carregar.</li>';
    }
}

// --- 4. WIDGET DE CLIMA (Open-Meteo API) ---
async function buscarClima(cidade) {
    weatherCity.textContent = cidade;
    weatherDesc.textContent = "Buscando...";

    try {
        // 1. Geocoding: Transforma nome da cidade em Lat/Lon
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt&format=json`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();

        if (!geoData.results || geoData.results.length === 0) {
            weatherDesc.textContent = "Local não encontrado";
            return;
        }

        const { latitude, longitude, name } = geoData.results[0];
        weatherCity.textContent = name; // Nome corrigido da API

        // 2. Clima: Pega temperatura atual
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
        const weatherRes = await fetch(weatherUrl);
        const weatherData = await weatherRes.json();

        const temp = Math.round(weatherData.current_weather.temperature);
        weatherTemp.textContent = `${temp}°C`;
        weatherDesc.textContent = "Atualizado agora";

        // Ícone simples baseado na temperatura (API simples não dá ícone direto fácil)
        const iconEl = document.getElementById('weatherIcon');
        if (temp > 25) iconEl.textContent = "☀️";
        else if (temp < 15) iconEl.textContent = "❄️";
        else iconEl.textContent = "⛅";

    } catch (error) {
        console.error("Erro clima:", error);
        weatherDesc.textContent = "Indisponível";
    }
}

// --- 5. VERSÃO DO SISTEMA ---
async function carregarVersao() {
    try {
        const res = await fetch('version.json');
        if (res.ok) {
            const data = await res.json();
            systemVersion.textContent = `Versão: ${data.version} (${data.last_update})`;
        }
    } catch (e) {
        console.warn("Sem arquivo de versão.");
    }
}