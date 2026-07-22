  // ============================================================
//  TOAST NOTIFICATION - GLOBAL FUNCTION
// ============================================================

function showToast(message, type = 'info') {
    // ===== VALIDASI =====
    if (!message) {
        console.warn('⚠️ showToast called without message');
        return;
    }
    
    // ===== KONFIGURASI =====
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    // ===== BUAT CONTAINER JIKA BELUM ADA =====
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 99999;
            width: 90%;
            max-width: 380px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }
    
    // ===== BUAT TOAST =====
    const toast = document.createElement('div');
    const color = colors[type] || '#3b82f6';
    const icon = icons[type] || 'ℹ️';
    
    toast.style.cssText = `
        background: var(--surface, #ffffff);
        color: var(--text, #1a1a2e);
        padding: 12px 16px;
        border-radius: 12px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.15);
        border-left: 4px solid ${color};
        margin-bottom: 8px;
        font-size: 13px;
        font-weight: 500;
        transition: opacity 0.3s ease, transform 0.3s ease;
        pointer-events: all;
        display: flex;
        align-items: center;
        gap: 10px;
        border: 1px solid var(--border, #e5e7eb);
    `;
    toast.innerHTML = `${icon} ${message}`;
    
    container.appendChild(toast);
    
    // ===== AUTO REMOVE SETELAH 3 DETIK =====
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, 3000);
}

 // ============================================================
    //  PASSWORD TOGGLE
    // ============================================================
    function togglePassword(inputId, button) {
      const input = document.getElementById(inputId);
      if (!input) return;
      const icon = button.querySelector('i');
      if (input.type === 'password') {
        input.type = 'text';
        if (icon) icon.setAttribute('data-lucide', 'eye-off');
      } else {
        input.type = 'password';
        if (icon) icon.setAttribute('data-lucide', 'eye');
      }
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    }

// ============================================================
    //  HELPERS
    // ============================================================
    function today() {
      return formatLocalDate(new Date());
    }
    
    function formatLocalDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    function formatExpiryDate(isoString) {
      if (!isoString) return '';
      const d = new Date(isoString);
      const options = { year: 'numeric', month: 'short', day: 'numeric' };
      return d.toLocaleDateString('en-US', options);
    }

    function addMonths(date, months) {
      const d = new Date(date);
      d.setMonth(d.getMonth() + months);
      return d;
    }

    function daysUntil(date) {
      const now = new Date();
      const target = new Date(date);
      const diff = target - now;
      return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

 function generateId() { return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) }

 // ============================================================
    //  NICKNAME FUNCTIONS
    // ============================================================
    function getNickname() {
      const nick = localStorage.getItem(NICKNAME_KEY + (currentUser || 'default'));
      return nick || 'Student';
    }

    function saveNickname() {
  const input = document.getElementById('nickname-input');
  const name = input.value.trim();
  if (!name) {
    alert('Please enter a name.');
    return;
  }
  localStorage.setItem(NICKNAME_KEY + currentUser, name);
  if (db) {
    db.collection('users').doc(currentUser).set({
      nickname: name,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(err => console.warn('⚠️ Could not save nickname to Firebase:', err));
  }
  updateHome();
  document.getElementById('nickname-input').value = name;

  // 👇 Tambahan ini langsung memperbarui Account di Settings
  const settingsUsername = document.getElementById('settings-username');
  if (settingsUsername) {
    settingsUsername.textContent = name;
  }

  alert('✅ Display name updated to "' + name + '"!');
} 

    function loadNickname() {
  const name = getNickname();
  const displayElement = document.getElementById('user-display-name');
  if (displayElement) displayElement.textContent = name;
  const input = document.getElementById('nickname-input');
  if (input) input.value = name;

  const settingsUsername = document.getElementById('settings-username');
  if (settingsUsername && currentUser) {
    const users = getUsers();
    const originalUsername = (users[currentUser] && users[currentUser].username) || currentUser;
    settingsUsername.textContent = (name && name !== 'Student') ? name : originalUsername;
  }
}

 // ============================================================
    //  THEME
    // ============================================================
    function toggleTheme() {
      document.documentElement.classList.toggle('dark');
      localStorage.setItem('Pharmadeck_theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      updateThemeToggle();
    }

 function updateThemeToggle() {
      const dark = document.documentElement.classList.contains('dark');
      const dot = document.getElementById('theme-toggle-dot');
      if (dot) dot.style.transform = dark ? 'translateX(20px)' : 'translateX(0)';
    }

function log(...args) {
    if (DEBUG) console.log(...args);
}

