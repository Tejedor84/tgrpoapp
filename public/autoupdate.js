/* =========================================================
   SISTEMA DE AUTO-UPDATE COM LIMPEZA DE CACHE
   ========================================================= */

// 1. Cria o estilo e o HTML do Popup automaticamente
function createUpdateModal() {
    if (document.getElementById('modal-update-system')) return;

    const style = document.createElement('style');
    style.innerHTML = `
        .update-modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.85);
            display: none; justify-content: center; align-items: center;
            z-index: 999999; backdrop-filter: blur(5px);
            animation: fadeIn 0.3s ease;
        }
        .update-modal-box {
            background: white; padding: 30px; border-radius: 12px;
            text-align: center; max-width: 400px; width: 90%;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            border-bottom: 5px solid #007bff;
            animation: slideUp 0.3s ease;
        }
        .update-icon { font-size: 45px; margin-bottom: 15px; }
        .update-modal-box h2 { margin: 0 0 10px 0; color: #333; }
        .update-modal-box p { color: #555; margin-bottom: 25px; line-height: 1.5; }
        .btn-update-now {
            background: #007bff; color: white; border: none;
            padding: 12px 30px; border-radius: 50px;
            font-size: 16px; font-weight: bold; cursor: pointer;
            width: 100%; transition: transform 0.2s;
        }
        .btn-update-now:hover { transform: scale(1.05); background: #0056b3; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); } to { transform: translateY(0); } }
    `;
    document.head.appendChild(style);

    const div = document.createElement('div');
    div.id = 'modal-update-system';
    div.className = 'update-modal-overlay';
    div.innerHTML = `
        <div class="update-modal-box">
            <div class="update-icon">🚀</div>
            <h2>Nova Versão Disponível!</h2>
            <p>Uma atualização importante foi realizada.<br>Clique abaixo para aplicar as mudanças.</p>
            <button class="btn-update-now" onclick="forceUpdate()">
                ATUALIZAR SISTEMA
            </button>
        </div>
    `;
    document.body.appendChild(div);
}

// 2. FUNÇÃO PODEROSA DE ATUALIZAÇÃO
window.forceUpdate = async function() {
    const btn = document.querySelector('.btn-update-now');
    if(btn) {
        btn.innerText = "Limpando cache e atualizando...";
        btn.disabled = true;
    }

    try {
        // A) Tenta desregistrar Service Workers (causadores comuns de cache preso)
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
            }
        }

        // B) Limpa Cache Storage do navegador
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
        }

        // C) Atualiza a versão no LocalStorage
        const response = await fetch('version.json?t=' + new Date().getTime());
        const data = await response.json();
        localStorage.setItem('app_version', data.version);

        console.log("Sistema limpo. Recarregando...");

        // D) FORÇA O RELOAD "NUCLEAR"
        // Adiciona um timestamp na URL para o navegador achar que é uma página nova
        const url = new URL(window.location.href);
        url.searchParams.set('forceUpdate', Date.now());
        window.location.href = url.toString();

    } catch (e) {
        console.error("Erro no update:", e);
        window.location.reload(true);
    }
};

// 3. Verifica a versão
async function checkVersion() {
    try {
        createUpdateModal();
        // Timestamp evita cache do JSON
        const response = await fetch('version.json?t=' + new Date().getTime()); 
        if (!response.ok) return;

        const data = await response.json();
        const serverVersion = data.version;
        const localVersion = localStorage.getItem('app_version');

        if (localVersion && localVersion !== serverVersion) {
            const modal = document.getElementById('modal-update-system');
            if (modal) modal.style.display = 'flex';
        } else {
            localStorage.setItem('app_version', serverVersion);
        }
    } catch (error) {
        console.warn('Erro ao verificar versão:', error);
    }
}

// Inicia
document.addEventListener('DOMContentLoaded', () => {
    // Verifica logo ao abrir
    setTimeout(checkVersion, 1000);
    // Verifica a cada 2 minutos
    setInterval(checkVersion, 120000);
});