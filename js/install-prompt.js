// ============================================================
// PROMPT DE INSTALAÇÃO PWA — Vanguard
// Captura beforeinstallprompt e exibe UI customizada
// ============================================================

(function(){
  'use strict';

  let deferredPrompt = null;
  let installBanner = null;

  // ============ CAPTURA O EVENTO DE INSTALAÇÃO ============
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('[PWA] beforeinstallprompt capturado');
    e.preventDefault(); // impede o prompt nativo do browser
    deferredPrompt = e;
    showInstallBanner();
  });

  // ============ VERIFICA SE JÁ FOI INSTALADO ============
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App instalado com sucesso!');
    deferredPrompt = null;
    hideInstallBanner();
    localStorage.setItem('vanguard_installed', 'true');
    showInstalledToast();
  });

  // ============ DETECTA MODO STANDALONE (já instalado) ============
  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }

  // ============ CRIA O BANNER DE INSTALAÇÃO ============
  function createBanner() {
    if (installBanner) return installBanner;

    installBanner = document.createElement('div');
    installBanner.id = 'pwa-install-banner';
    installBanner.innerHTML = `
      <style>
        #pwa-install-banner{
          position:fixed;bottom:20px;left:50%;transform:translateX(-50%) translateY(120%);
          background:linear-gradient(145deg,#151b2b,#0a0e17);
          border:1px solid rgba(212,175,55,.4);
          border-radius:16px;padding:16px 20px;
          box-shadow:0 10px 40px rgba(0,0,0,.6),0 0 30px rgba(212,175,55,.15);
          display:flex;align-items:center;gap:14px;
          max-width:92vw;width:440px;z-index:9999;
          transition:transform .4s cubic-bezier(.4,0,.2,1);
          backdrop-filter:blur(12px);
        }
        #pwa-install-banner.show{transform:translateX(-50%) translateY(0)}
        #pwa-install-banner .pwa-icon{
          width:48px;height:48px;border-radius:12px;
          background:radial-gradient(circle at 30% 30%,#f4d03f,#d4af37 40%,#8b6914);
          display:flex;align-items:center;justify-content:center;
          font-family:Georgia,serif;font-weight:900;color:#3d2a00;font-size:24px;
          flex-shrink:0;
          box-shadow:inset -2px -2px 5px rgba(0,0,0,.3),0 4px 10px rgba(212,175,55,.3);
        }
        #pwa-install-banner .pwa-text{flex:1;min-width:0}
        #pwa-install-banner .pwa-title{font-size:14px;font-weight:700;color:#e8eef5;margin-bottom:2px}
        #pwa-install-banner .pwa-desc{font-size:12px;color:#8b95a7;line-height:1.4}
        #pwa-install-banner .pwa-actions{display:flex;gap:8px;flex-shrink:0}
        #pwa-install-banner button{
          border:none;padding:8px 14px;border-radius:8px;
          font-size:12px;font-weight:700;cursor:pointer;transition:.2s;
          font-family:inherit;
        }
        #pwa-install-banner .btn-install{
          background:linear-gradient(135deg,#d4af37,#b8941f);color:#1a1400;
        }
        #pwa-install-banner .btn-install:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(212,175,55,.4)}
        #pwa-install-banner .btn-dismiss{
          background:transparent;color:#8b95a7;border:1px solid #1f2937;
        }
        #pwa-install-banner .btn-dismiss:hover{color:#e8eef5;border-color:#d4af37}
        @media(max-width:480px){
          #pwa-install-banner{flex-direction:column;text-align:center;padding:18px}
          #pwa-install-banner .pwa-actions{width:100%;justify-content:stretch}
          #pwa-install-banner .pwa-actions button{flex:1}
        }
      </style>
      <div class="pwa-icon">V</div>
      <div class="pwa-text">
        <div class="pwa-title">Instalar Vanguard</div>
        <div class="pwa-desc">Acesse cotações, loterias IA e muito mais direto da tela inicial</div>
      </div>
      <div class="pwa-actions">
        <button class="btn-dismiss" id="pwa-dismiss">Agora não</button>
        <button class="btn-install" id="pwa-install">⚡ Instalar</button>
      </div>
    `;
    document.body.appendChild(installBanner);

    // Eventos dos botões
    installBanner.querySelector('#pwa-install').addEventListener('click', installApp);
    installBanner.querySelector('#pwa-dismiss').addEventListener('click', dismissBanner);

    return installBanner;
  }

  // ============ EXIBE O BANNER ============
  function showInstallBanner() {
    // Não mostra se já instalado ou se usuário dispensou recentemente
    if (localStorage.getItem('vanguard_installed') === 'true') return;
    if (isStandalone()) return;
    
    const dismissedAt = localStorage.getItem('vanguard_dismissed_at');
    if (dismissedAt) {
      const hours = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60);
      if (hours < 24 * 7) return; // não mostra por 7 dias
    }

    const banner = createBanner();
    // Pequeno delay para animação
    setTimeout(() => banner.classList.add('show'), 300);

    // Auto-esconde após 20s se não interagir
    setTimeout(() => {
      if (banner.classList.contains('show')) {
        hideInstallBanner();
      }
    }, 20000);
  }

  function hideInstallBanner() {
    if (installBanner) {
      installBanner.classList.remove('show');
    }
  }

  // ============ INSTALA O APP ============
  async function installApp() {
    if (!deferredPrompt) {
      // Fallback: mostra instruções manuais
      showManualInstallInstructions();
      return;
    }
    
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA] Resposta do usuário: ${outcome}`);
      
      if (outcome === 'accepted') {
        localStorage.setItem('vanguard_installed', 'true');
      }
      deferredPrompt = null;
      hideInstallBanner();
    } catch (err) {
      console.error('[PWA] Erro na instalação:', err);
      showManualInstallInstructions();
    }
  }

  // ============ DISPENSA O BANNER ============
  function dismissBanner() {
    hideInstallBanner();
    localStorage.setItem('vanguard_dismissed_at', Date.now().toString());
  }

  // ============ TOAST DE SUCESSO ============
  function showInstalledToast() {
    const toast = document.createElement('div');
    toast.innerHTML = `
      <div style="
        position:fixed;top:20px;right:20px;z-index:10000;
        background:linear-gradient(135deg,#00d68f,#00a870);
        color:#fff;padding:14px 20px;border-radius:12px;
        box-shadow:0 10px 30px rgba(0,214,143,.4);
        font-weight:600;font-size:14px;
        animation:slideIn .4s ease;
      ">
        ✅ Vanguard instalado! Acesse na tela inicial
      </div>
      <style>@keyframes slideIn{from{transform:translateX(120%)}to{transform:translateX(0)}}</style>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // ============ INSTRUÇÕES MANUAIS (fallback) ============
  function showManualInstallInstructions() {
    const ua = navigator.userAgent;
    let instructions = '';
    
    if (/iPhone|iPad/.test(ua)) {
      instructions = '📱 <strong>iPhone/iPad:</strong> toque no botão Compartilhar ⬆️ e depois "Adicionar à Tela de Início"';
    } else if (/Android/.test(ua)) {
      instructions = '📱 <strong>Android:</strong> toque no menu ⋮ do navegador e selecione "Instalar aplicativo"';
    } else if (/Chrome/.test(ua)) {
      instructions = '💻 <strong>Desktop:</strong> clique no ícone de instalação na barra de endereço (⊕)';
    } else if (/Safari/.test(ua)) {
      instructions = '💻 <strong>Safari:</strong> menu Arquivo → Adicionar aos Favoritos';
    } else {
      instructions = 'Use o menu do seu navegador e procure por "Instalar aplicativo" ou "Adicionar à tela inicial"';
    }

    const modal = document.createElement('div');
    modal.innerHTML = `
      <div style="
        position:fixed;inset:0;background:rgba(0,0,0,.8);backdrop-filter:blur(8px);
        z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;
      " onclick="if(event.target===this)this.remove()">
        <div style="
          background:#151b2b;border:1px solid rgba(212,175,55,.4);
          border-radius:16px;padding:28px;max-width:420px;width:100%;
          color:#e8eef5;
        ">
          <h3 style="color:#d4af37;margin-bottom:12px">📲 Como instalar</h3>
          <p style="color:#8b95a7;line-height:1.6;font-size:14px">${instructions}</p>
          <button onclick="this.closest('div[style]').remove()" style="
            margin-top:18px;width:100%;background:linear-gradient(135deg,#d4af37,#b8941f);
            color:#1a1400;border:none;padding:12px;border-radius:10px;
            font-weight:700;cursor:pointer;font-family:inherit;
          ">Entendi</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // ============ REGISTRA O SERVICE WORKER ============
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        console.log('[PWA] SW registrado:', reg.scope);

        // Detecta atualização disponível
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateBanner();
            }
          });
        });
      } catch (err) {
        console.error('[PWA] Falha ao registrar SW:', err);
      }
    });
  }

  // ============ BANNER DE ATUALIZAÇÃO ============
  function showUpdateBanner() {
    const banner = document.createElement('div');
    banner.innerHTML = `
      <div style="
        position:fixed;bottom:20px;right:20px;z-index:9999;
        background:linear-gradient(135deg,#151b2b,#0a0e17);
        border:1px solid rgba(212,175,55,.4);
        border-radius:12px;padding:14px 18px;
        box-shadow:0 10px 30px rgba(0,0,0,.5);
        display:flex;align-items:center;gap:12px;
      ">
        <span style="color:#d4af37;font-size:20px">✨</span>
        <span style="color:#e8eef5;font-size:13px">Nova versão disponível!</span>
        <button onclick="location.reload()" style="
          background:#d4af37;color:#1a1400;border:none;
          padding:6px 12px;border-radius:6px;font-weight:700;
          cursor:pointer;font-size:12px;font-family:inherit;
        ">Atualizar</button>
      </div>
    `;
    document.body.appendChild(banner.firstElementChild);
  }

  // ============ EXPÕE API GLOBAL (opcional) ============
  window.VanguardPWA = {
    promptInstall: () => deferredPrompt && installApp(),
    isInstalled: isStandalone,
    clearCache: () => navigator.serviceWorker.controller?.postMessage({ data: 'CLEAR_CACHE' })
  };

})();