/* =========================================================
   SISTEMA DE AUTO-UPDATE COM POPUP (INJECTED)
   ========================================================= */

// 1. Cria o estilo e o HTML do Popup automaticamente
function createUpdateModal() {
    // Se já existe, não cria de novo
    if (document.getElementById('modal-update-system')) return;

    // --- CSS DO POPUP ---
    const style = document.createElement('style');
    style.innerHTML = `
        .update-modal-overlay {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: none; /* Escondido por padrão */
            justify-content: center;
            align-items: center;
            z-index: 99999; /* Acima de tudo */
            backdrop-filter: blur(4px);
            animation: fadeIn 0.3s ease;
        }

        .update-modal-box {
            background: white;
            padding: 30px;
            border-radius: 12px;
            text-align: center;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            border-bottom: 4px solid #007bff;
            animation: slideUp 0.3s ease;
        }

        .update-icon {
            font-size: 40px;
            color: #007bff;
            margin-bottom: 15px;
        }

        .update-modal-box h2 {
            margin: 0 0 10px 0;
            color: #333;
            font-family: sans-serif;
        }

        .update-modal-box p {
            color: #666;
            margin-bottom: 25px;
            line-height: 1.5;
            font-size: 14px;
        }

        .btn-update-now {
            background: #007bff;
            color: white;
            border: none;
            padding: 12px 25px;
            border-radius: 50px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.2s, background 0.2s;
            width: 100%;
        }

        .btn-update-now:hover {
            background: #0056b3;
            transform: scale(1.02);
        }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); } to { transform: translateY(0); } }
    `;
    document.head.appendChild(style);

    // --- HTML DO POPUP ---
    const div = document.createElement('div');
    div.id = 'modal-update-system';
    div.className = 'update-modal-overlay';
    div.innerHTML = `
        <div class="update-modal-box">
            <div class="update-icon">🚀</div>
            <h2>Nova Versão Disponível</h2>
            <p>O sistema foi atualizado com melhorias e correções.<br>Clique abaixo para carregar a nova versão.</p>
            <button class="btn-update-now" onclick="forceUpdate()">
                ATUALIZAR AGORA
            </button>
        </div>
    `;
    document.body.appendChild(div);
}

// 2. Função que realiza a limpeza e o reload
window.forceUpdate = async function() {
    const btn = document.querySelector('.btn-update-now');
    btn.innerText = "Atualizando...";
    btn.disabled = true;

    try {
        // a) Limpa Cache Storage (Service Workers, se houver)
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
            console.log('Caches limpos.');
        }

        // b) Busca a nova versão do servidor para garantir que temos a string correta
        const response = await fetch('version.json?t=' + new Date().getTime());
        const data = await response.json();
        
        // c) Salva a nova versão no LocalStorage
        localStorage.setItem('app_version', data.version);

        // d) Força o reload ignorando o cache do navegador (Hard Reload)
        window.location.reload(true);

    } catch (e) {
        console.error("Erro ao atualizar:", e);
        // Fallback se der erro: reload simples
        window.location.reload();
    }
};

// 3. Verifica a versão periodicamente
async function checkVersion() {
    try {
        // Cria o modal se ele ainda não existir na página
        createUpdateModal();

        // Busca versão no servidor (com timestamp para evitar cache do JSON)
        const response = await fetch('version.json?t=' + new Date().getTime());
        const data = await response.json();
        const serverVersion = data.version;
        
        const localVersion = localStorage.getItem('app_version');

        // Debug no console (para você testar)
        // console.log(`Local: ${localVersion} | Servidor: ${serverVersion}`);

        if (localVersion && localVersion !== serverVersion) {
            // MOSTRA O POPUP!
            const modal = document.getElementById('modal-update-system');
            if (modal) modal.style.display = 'flex';
        } else {
            // Se for primeira vez ou estiver atualizado, apenas sincroniza
            localStorage.setItem('app_version', serverVersion);
        }

    } catch (error) {
        console.warn('Não foi possível verificar atualização:', error);
    }
}

// Inicia verificação
document.addEventListener('DOMContentLoaded', () => {
    // Verifica após 2 segundos de carregamento
    setTimeout(checkVersion, 2000);
    
    // Verifica novamente a cada 60 segundos
    setInterval(checkVersion, 60000);
});