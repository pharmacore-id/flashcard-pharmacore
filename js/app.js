// ============================================================
//  BOOTSTRAP - SINGLE SOURCE OF TRUTH
// ============================================================

async function bootstrap(user) {
    window.__startupAt = performance.now();
    
    if (!user) {
        console.log('🔴 No user, showing login');
        showLoginPage();
        return;
    }
    
    if (bootstrapped) {
        console.log('⚠️ Bootstrap already done, skipping...');
        return;
    }
    bootstrapped = true;
    
    // ===== AUTH =====
    currentUser = user.email;
    isAdmin = ADMIN_EMAILS.includes(user.email);
    authReady = true;
    
    // ===== ENTER APP =====
    enterApp();
    
    // ===== TIME TO INTERACTIVE =====
    const tti = performance.now() - window.__startupAt;
    console.log('🚀 Time to Interactive:', Math.round(tti), 'ms');
    
    // ===== LOAD DATA BACKGROUND =====
    loadDataInBackground().catch(error => {
        console.error('❌ Background data load failed:', error);
    });
}

function resetSessionStats(){
    sessionStats = {
        again: 0,
        hard: 0,
        good: 0,
        easy: 0
    };
}

async function loadDataInBackground() {
    console.time('⏱️ loadDataInBackground.total');
    try {
        if (!currentUser) {
            console.warn('⚠️ loadDataInBackground called without user');
            return;
        }
        
        const loaded = await loadUserData(currentUser);
        
        if (!loaded) {
            dataHealthy = false;
            console.warn('⚠️ Data incomplete');
            allCards = [];
            return;
        }
        
        dataHealthy = true;
        dataReady = true;
        
        await migrateLocalStorageToIndexedDB(currentUser);
        
        renderDecks();
        updateHome();
        
        console.log('✅ Data loaded successfully');
        console.log('📊 Cards in UI:', allCards?.length || 0);
        
    } catch (error) {
        console.error('❌ Data loading error:', error);
        allCards = [];
    } finally {
        console.timeEnd('⏱️ loadDataInBackground.total');
    }
}

 function navClickHandler() {
      if (navTimeout) return;
      navTimeout = setTimeout(() => {
        navTimeout = null;
      }, 300);

      const tab = this.dataset.tab;

      if (document.getElementById('view-flashcards').classList.contains('active')) {
        if (!confirm('Exit current study session?')) return;
        exitStudy();
      }
      if (document.getElementById('view-learn').classList.contains('active')) {
        if (!confirm('Exit current study session?')) return;
        exitStudy();
      }
      if (document.getElementById('view-test').classList.contains('active')) {
        if (!confirm('Exit current study session?')) return;
        exitStudy();
      }

      switchTab(tab);
    }


    // ============================================================
    //  INIT
   // ============================================================

// Theme
if (localStorage.getItem('Pharmadeck_theme') === 'dark') {
    document.documentElement.classList.add('dark');
}

// ===== INITIALIZATION =====
// ============================================================
//  INIT - PURE FALLBACK (TANPA BOOTSTRAP LOGIC)
// ============================================================

(async function init() {
    if (initDone) {
        console.log('⚠️ Init already done, skipping...');
        return;
    }
    initDone = true;
    
    console.log('🚀 Init fallback check');
    
    // ============================================================
    //  JIKA BOOTSTRAP BELUM TERJADI, BANTU PAKAI CURRENT USER
    // ============================================================
    if (!bootstrapped) {
        const user = firebase.auth().currentUser;
        console.log('📌 Fallback user:', user?.email || 'No user');
        bootstrap(user);
    } else {
        console.log('✅ Bootstrap already done, init skip');
    }
})();

firebase.auth().onAuthStateChanged(async user => {
    console.log('🔥 Auth State Changed:', user?.email || 'No user');
    bootstrap(user);
});
