// ============================================================
    //  KEYBOARD SHORTCUTS
    // ============================================================
    document.addEventListener('keydown', (e) => {
      if (document.getElementById('view-flashcards').classList.contains('active')) {
        if (!document.getElementById('fc-buttons').classList.contains('hidden')) {
          if (e.key === '1') fcRate(0);
          else if (e.key === '2') fcRate(1);
          else if (e.key === '3') fcRate(2);
          else if (e.key === '4') fcRate(3);
        }
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault();
          fcFlip() }
      }
      if (document.getElementById('view-learn').classList.contains('active')) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (document.getElementById('ln-show-btn').style
            .display !== 'none') lnShowAnswer() }
        if (!document.getElementById('ln-grade-btns').classList.contains('hidden')) {
          if (e.key === '1') lnGrade(false);
          else if (e.key === '2') lnGrade(true);
        }
      }
      if (document.getElementById('view-test').classList.contains('active')) {
        if (e.key === 'Enter' && !document.getElementById('ts-type-area').classList.contains('hidden')) { e
            .preventDefault();
          tsSubmitTyped() }
      }
      if (e.key === 'Escape') { closeUpgradeModal();
        closeContactAdmin(); }
    });

// ============================================================
//  EVENT LISTENERS
// ============================================================

document.getElementById('bottomNav').addEventListener('click', function(e) {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    navClickHandler.call(btn, e);
});

window.addEventListener('online', () => {
    console.log('🌐 Online, scheduling sync...');
    updateSyncStatus('syncing', 'Syncing...');
    scheduleSync(1000);
});

const uploadZone = document.getElementById('upload-zone');
if (uploadZone) {
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
            const event = { target: { files: [file] } };
            handleExcelImport(event);
        } else {
            alert('Please upload an Excel file (.xlsx or .xls)');
        }
    });
}

if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
}

console.log('🚀 Pharmadeck · Pharmacy Study App (Optimized & Error-Free)');
console.log('📊 Plan:', userPlan);
console.log('👑 Admin:', isAdmin);
console.log('📚 Cards:', getRealCards().length, 'Decks:', getDecks().length);
console.log('☁️ Firebase: Connected & Syncing');
console.log('📝 Admin email: adm.pharmacore@gmail.com');
// ======================================================
// PULL TO REFRESH - Gaya Atsumaru
// ======================================================

let touchStartY = 0;
let touchEndY = 0;
let isRefreshing = false;
const PULL_THRESHOLD = 180; // Jarak tarik dalam pixel

const pullIndicator = document.getElementById('pull-indicator');
const pullText = document.getElementById('pull-text');
const pullSpinner = pullIndicator.querySelector('.pull-spinner');

document.addEventListener("touchstart", e => {
    // ONLY allow pull to refresh if we are already at the VERY TOP
    if (window.scrollY === 0 && !isRefreshing) {
        touchStartY = e.touches[0].clientY;
        pullIndicator.style.opacity = "0";
        pullIndicator.style.top = "-80px";
        pullSpinner.style.display = "none";
    }
}, { passive: true });

document.addEventListener("touchmove", e => {
    if (window.scrollY !== 0 || isRefreshing) return;

    touchEndY = e.touches[0].clientY;
    const pullDistance = touchEndY - touchStartY;

    if (pullDistance > 0) {
        // Ikuti jari pengguna (maks 150px)
        const moveY = Math.min(pullDistance, 220);
        pullIndicator.style.opacity = Math.min(pullDistance / PULL_THRESHOLD, 1);
        pullIndicator.style.top = (moveY - 80) + "px";
        
        if (pullDistance > PULL_THRESHOLD) {
            pullText.textContent = "Lepaskan untuk refresh";
        } else {
            pullText.textContent = "Tarik untuk refresh";
        }
    }
}, { passive: true });

document.addEventListener("touchend", async () => {
    if (isRefreshing) return;

    const pullDistance = touchEndY - touchStartY;

    if (pullDistance > PULL_THRESHOLD) {
        // Aktifkan refresh
        isRefreshing = true;
        pullText.textContent = "Memperbarui...";
        pullSpinner.style.display = "block";
        
        // Tahan di posisi refresh sebentar
        pullIndicator.style.top = "20px";
        pullIndicator.style.opacity = "1";

        try {
            console.log("🔄 Refreshing data...");
            
            // Panggil fungsi refresh data Anda
            await loadUserData(currentUser);
            renderDecks();
            updateHome();
            if (typeof renderStats === 'function') renderStats();
            updateSyncStatus("", "Synced");

        } catch (err) {
            console.error("Refresh failed:", err);
            updateSyncStatus("offline", "Refresh failed");
        } finally {
            // Kembali ke posisi semula
            setTimeout(() => {
                pullIndicator.style.top = "-80px";
                pullIndicator.style.opacity = "0";
                pullSpinner.style.display = "none";
                isRefreshing = false;
                touchStartY = 0;
                touchEndY = 0;
            }, 400);
        }
    } else {
        // Tarikannya kurang jauh, kembali ke atas
        pullIndicator.style.top = "-80px";
        pullIndicator.style.opacity = "0";
        pullSpinner.style.display = "none";
        touchStartY = 0;
        touchEndY = 0;
    }
}, { passive: true });
