function showLogin() {
      document.getElementById('view-login').classList.add('active');
      document.getElementById('view-signup').classList.remove('active');
    }

    function showSignup() {
      document.getElementById('view-signup').classList.add('active');
      document.getElementById('view-login').classList.remove('active');
    }

 async function handleLogin(e) {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const pw = document.getElementById('login-password').value;
      const err = document.getElementById('login-error');
      err.textContent = '';
      try {
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, pw);
        const user = userCredential.user;
        currentUser = email;
        await loadUserData(email);
      } catch (error) {
        console.error('Login error:', error);
        if (error.code === 'auth/user-not-found') {
          err.textContent = 'No account found. Please sign up first.';
        } else if (error.code === 'auth/wrong-password') {
          err.textContent = 'Incorrect password.';
        } else if (error.code === 'auth/invalid-email') {
          err.textContent = 'Invalid email address.';
        } else if (error.code === 'auth/too-many-requests') {
          err.textContent = 'Too many failed attempts. Please try again later.';
        } else if (error.code === 'auth/invalid-credential') {
          err.textContent = 'Wrong information. Please check your email and password.';
        } else {err.textContent = 'Login failed: ' + error.message;
        }}}

 async function handleSignup(e) {
  e.preventDefault();
  const un = document.getElementById('signup-username').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pw = document.getElementById('signup-password').value;
  const cf = document.getElementById('signup-confirm').value;
  const err = document.getElementById('signup-error');

  err.textContent = '';

  if (!un || !email || !pw || !cf) { err.textContent = 'All fields required.'; return; }
  if (pw.length < 6) { err.textContent = 'Password min 6 chars.'; return; }
  if (pw !== cf) { err.textContent = 'Passwords do not match.'; return; }

  try {
    const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, pw);
    const user = userCredential.user;
    await user.updateProfile({ displayName: un });

    const isAdminUser = ADMIN_EMAILS.includes(email);

    const plan = isAdminUser ? 'premium' : 'free';
    const expiry = null;

    const users = getUsers();
    users[email] = {
      username: un,
      email,
      created: Date.now(),
      plan: plan,
      isBookBuyer: false,
      isAdmin: isAdminUser
    };
    saveUsers(users);

    currentUser = email;
    allCards = await loadSharedDecks();
    if (isAdminUser) {
      savePlan(email, 'premium', expiry);
    }

    isAdmin = isAdminUser;
    enterApp();

    if (isAdminUser) {
      alert('👑 Admin account created! You have full admin access.');
    }

  } catch (error) {
    console.error('Signup error:', error);
    if (error.code === 'auth/email-already-in-use') {
      err.textContent = 'Email already registered. Please login or use another email.';
    } else if (error.code === 'auth/weak-password') {
      err.textContent = 'Password is too weak. Use at least 6 characters.';
    } else if (error.code === 'auth/invalid-email') {
      err.textContent = 'Invalid email address.';
    } else {
      err.textContent = 'Signup failed: ' + error.message;
    }
  }
}

// ============================================================
    //  CHANGE PASSWORD
    // ============================================================
    async function changePassword() {
      const current = document.getElementById('current-password').value;
      const newPw = document.getElementById('new-password').value;
      const confirmPw = document.getElementById('confirm-new-password').value;
      const err = document.getElementById('change-password-error');

      err.textContent = '';

      const user = firebase.auth().currentUser;
      if (!user) {
        err.textContent = 'Please login first.';
        return;
      }

      try {
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, current);
        await user.reauthenticateWithCredential(credential);

        if (newPw.length < 6) {
          err.textContent = 'New password must be at least 6 characters.';
          return;
        }

        if (newPw !== confirmPw) {
          err.textContent = 'Passwords do not match.';
          return;
        }

        await user.updatePassword(newPw);

        const users = getUsers();
        if (users[user.email]) {
          users[user.email].password = newPw;
          saveUsers(users);
        }

        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-new-password').value = '';

        alert('✅ Password changed successfully!');

      } catch (error) {
        console.error('Password change error:', error);
        if (error.code === 'auth/wrong-password') {
          err.textContent = 'Current password is incorrect.';
        } else if (error.code === 'auth/too-many-requests') {
          err.textContent = 'Too many failed attempts. Please try again later.';
        } else {
          err.textContent = 'Failed to change password: ' + error.message;
        }
      }
    }


 // ============================================================
    //  FORGOT PASSWORD
    // ============================================================
    function showForgotPassword() {
      document.getElementById('forgot-password-modal').classList.remove('hidden');
      document.getElementById('fp-step-1').classList.remove('hidden');
      document.getElementById('fp-step-2').classList.add('hidden');
      document.getElementById('fp-email').value = '';
      document.getElementById('fp-error').textContent = '';
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    }

    function closeForgotPassword() {
      document.getElementById('forgot-password-modal').classList.add('hidden');
    }

    async function sendResetCode() {
      const email = document.getElementById('fp-email').value.trim();
      const err = document.getElementById('fp-error');

      err.textContent = '';

      if (!email) {
        err.textContent = 'Please enter your email.';
        return;
      }

      try {
        await firebase.auth().sendPasswordResetEmail(email);
        document.getElementById('fp-email-display').textContent = email;
        document.getElementById('fp-step-1').classList.add('hidden');
        document.getElementById('fp-step-2').classList.remove('hidden');
      } catch (error) {
        console.error('Reset error:', error);
        if (error.code === 'auth/user-not-found') {
          err.textContent = 'No account found with this email.';
        } else {
          err.textContent = 'Failed to send reset email: ' + error.message;
        }
      }
    }


// ============================================================
//  LOAD USER DATA - CACHE-FIRST + FIRESTORE FALLBACK
//  Sprint B1.5 - Dengan timestamp tracking
// ============================================================

async function loadUserData(email) {
    console.time('⏱️ loadUserData.total');
    try {
        if (!email) return false;

        console.log('🔍 Loading user data for:', email);

        // ===== STEP 1: LOAD INDEXEDDB =====
        console.time('⏱️ loadUserData.indexeddb');
        let cachedRecord = null;
        let cachedProgress = null;

        try {
            cachedRecord = await loadFromIndexedDB(email);
            if (cachedRecord && cachedRecord.cards && cachedRecord.cards.length > 0) {
                cachedProgress = cachedRecord.cards;
                console.log('📦 Found cached progress in IndexedDB:', cachedProgress.length, 'cards');
            }
        } catch (error) {
            console.warn('⚠️ IndexedDB load failed:', error);
        }
        console.timeEnd('⏱️ loadUserData.indexeddb');

        // ===== STEP 2: LOAD SHARED DECKS =====
        console.time('⏱️ loadUserData.sharedDecks');
        let sharedCards = [];
        try {
            const result = await loadSharedDecksOnce();
            sharedCards = result.cards || result;
            console.log('📚 Shared decks loaded:', sharedCards.length, 'cards');
        } catch (error) {
            console.warn('⚠️ Shared decks load failed:', error);
        }
        console.timeEnd('⏱️ loadUserData.sharedDecks');

        // ===== STEP 3: MERGE =====
        if (cachedProgress && sharedCards.length > 0) {
            console.log('📊 Cached progress:', cachedProgress.length);
            console.log('📊 Shared cards:', sharedCards.length);
            
            console.time('⏱️ loadUserData.merge');
            allCards = mergeProgress(sharedCards, cachedProgress);
            userPlan = cachedRecord.plan || 'free';
            console.timeEnd('⏱️ loadUserData.merge');
            
            console.log('✅ Merged:', allCards.length, 'cards');
            return true;
        }

        // ===== STEP 4: FIRESTORE FALLBACK =====
        console.log('📂 No cache, loading from Firestore...');
        
        console.time('⏱️ loadUserData.firestore');
        let cloudData = null;
        try {
            cloudData = await loadFromFirebase(email);
            console.log('☁️ Cloud data loaded:', cloudData?.cards?.length || 0);
        } catch (err) {
            console.warn('⚠️ Cloud load failed:', err.message);
        }
        console.timeEnd('⏱️ loadUserData.firestore');

        if (cloudData && cloudData.cards && cloudData.cards.length > 0) {
            allCards = mergeProgress(sharedCards, cloudData.cards);
            userPlan = cloudData.plan || 'free';
            console.log('✅ Merged from Firestore:', allCards.length, 'cards');
            return true;
        }

        console.warn('⚠️ No data found for user:', email);
        allCards = [];
        userPlan = 'free';
        return false;
        
    } finally {
        console.timeEnd('⏱️ loadUserData.total');
    }
}
    
 

// ============================================================
//  SAVE USER DATA - DENGAN TIMESTAMP TRACKING
// ============================================================

async function saveUserData(email) {
    if (!email) return;
    if (!allCards || allCards.length === 0) {
        console.warn('⚠️ saveUserData skipped: allCards is empty');
        return;
    }

    // ===== STEP 1: SAVE KE INDEXEDDB (LANGSUNG) =====
    const indexSnapshot = createProgressSnapshot();
    
    await saveToIndexedDB(email, {
        cards: indexSnapshot.cards,
        plan: indexSnapshot.plan,
        schema_version: indexSnapshot.schema_version,
        markProgressUpdated: true  // ← TANDA PROGRESS BERUBAH
    });
    console.log('📦 IndexedDB saved (local)');

    // ===== STEP 2: METADATA DI LOCALSTORAGE =====
    try {
        localStorage.setItem('Pharmadeck_metadata_' + email, JSON.stringify({
            plan: indexSnapshot.plan,
            cardsCount: indexSnapshot.cards.length,
            lastUpdated: Date.now()
        }));
    } catch (e) {
        console.warn('⚠️ Metadata save failed:', e);
    }

    // ===== STEP 3: DEBOUNCE FIRESTORE =====
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(async () => {
        // ============================================================
        //  SNAPSHOT DIBUAT DI DALAM DEBOUNCE (FRESH!)
        // ============================================================
        const snapshot = createProgressSnapshot();
        const planSnapshot = userPlan;

        let retries = 3;
        let saved = false;

        while (retries > 0 && !saved) {
            try {
                const saveTime = Date.now();  // ← SETIAP RETRY BUAT BARU

                await db.collection('users').doc(email).set({
                    cards: snapshot.cards,
                    plan: planSnapshot,
                    schema_version: CURRENT_SCHEMA_VERSION,
                    last_updated: saveTime
                }, { merge: true });

                saved = true;
                console.log('☁️ FIREBASE SAVE:', {
                    cards: snapshot.cards.length,
                    timestamp: saveTime
                });

                // ============================================================
                //  UPDATE cloudUpdatedAt SETELAH UPLOAD BERHASIL
                // ============================================================
                await saveToIndexedDB(email, {
                    cloudUpdatedAt: saveTime
                    // TIDAK ADA markProgressUpdated!
                });
                console.log('📦 cloudUpdatedAt updated in IndexedDB');

            } catch (err) {
                retries--;
                console.warn(`⚠️ Save failed (${3 - retries}/3):`, err.message);
                if (retries > 0) {
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
        }

        if (!saved) {
            console.error('❌ Save failed after 3 retries');
        }

    }, 2000);
scheduleSync(3000);
}

  async function handleLogout() {
    console.log('🚪 Logout started...');
    
    // ===== TAMPILKAN LOADING =====
    var overlay = document.getElementById('logout-overlay');
    if (overlay) overlay.classList.add('active');
    
    // ===== DISABLE TOMBOL LOGOUT =====
    var logoutBtn = document.querySelector('.bg-red-500');
    if (logoutBtn) {
        logoutBtn.disabled = true;
        logoutBtn.textContent = 'Logging out...';
    }
    
    try {
        // ============================================================
        //  SAVE DATA DI BACKGROUND (TANPA MENUNGGU LAMA)
        // ============================================================
        if (currentUser) {
            console.log('💾 Starting background save...');
            
            if (saveTimeout) {
                clearTimeout(saveTimeout);
                saveTimeout = null;
            }
            
            // ============================================================
            //  ✅ JANGAN TUNGGU! KASIH BATAS WAKTU 3 DETIK
            // ============================================================
            try {
                await Promise.race([
                    flushSaveNow(currentUser),
                    new Promise(resolve => setTimeout(resolve, 3000))
                ]);
                console.log('✅ Save completed (or timed out)');
            } catch (e) {
                console.error('❌ Save error:', e);
            }
        }
        
        // ============================================================
        //  SIGNOUT DARI FIREBASE (CEPAT)
        // ============================================================
        console.log('🔥 Signing out from Firebase...');
        await firebase.auth().signOut();
        console.log('✅ Firebase signOut success');
        
        // ============================================================
        //  CLEANUP
        // ============================================================
        console.log('🧹 Cleaning up...');
        clearSession();
        localStorage.removeItem('Pharmadeck_session_token');
        localStorage.removeItem('Pharmadeck_token_expiry');
        currentUser = null;
        allCards = [];
        isAdmin = false;
        
        // ============================================================
        //  UPDATE UI
        // ============================================================
        console.log('🎨 Updating UI...');
        document.querySelectorAll('.view').forEach(function(v) {
            v.classList.remove('active');
            v.style.display = 'none';
        });
        
        var loginView = document.getElementById('view-login');
        if (loginView) {
            loginView.classList.add('active');
            loginView.style.display = 'flex';
        }
        
        var emailInput = document.getElementById('login-email');
        var passInput = document.getElementById('login-password');
        if (emailInput) emailInput.value = '';
        if (passInput) passInput.value = '';
        
        var bottomNav = document.getElementById('bottomNav');
        if (bottomNav) bottomNav.style.display = 'none';
        
        console.log('✅ Logout complete!');
        
    } catch (error) {
        console.error('❌ Logout error:', error);
        alert('Logout error: ' + error.message);
    } finally {
        // ===== HILANGKAN LOADING =====
        if (overlay) overlay.classList.remove('active');
        if (logoutBtn) {
            logoutBtn.disabled = false;
            logoutBtn.textContent = 'Logout';
        }
    }
}

// ============================================================
//  ENTER APP - DENGAN GLOBAL DECK ORDER
// ============================================================
function enterApp() {
    if (appEntered) {
        console.log('⚠️ enterApp already called, skipping...');
        return;
    }
    appEntered = true;
    
    console.log('🚀 Entering App (UI rendering only)');
    console.log('👤 User:', currentUser);
    console.log('📚 Cards:', allCards?.length || 0);
    
    // ============================================================
    //  ASUMSI: currentUser PASTI ADA (sudah dijamin oleh bootstrap)
    //  JIKA TIDAK ADA, TAMPILKAN LOGIN (TAPI HATI-HATI!)
    // ============================================================
    if (!currentUser) {
        console.warn('⚠️ enterApp called without user!');
        showLoginPage();
        return;
    }
    
    // ============================================================
    //  SYNC DI BACKGROUND (TIDAK MEMBLOKIR UI)
    // ============================================================
    if (navigator.onLine && currentUser) {
        console.log('🌐 App started online, checking sync...');
        scheduleSync(2000);
    }
    
    // ============================================================
    //  TAMPILKAN UI (DATA KOSONG ATAU TIDAK, TETAP MASUK!)
    // ============================================================
    document.getElementById('bottomNav').style.display = 'flex';
    
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
        v.style.display = 'none';
    });
    
    const homeView = document.getElementById('view-home');
    if (homeView) {
        homeView.classList.add('active');
        homeView.style.display = 'flex';
    }
    
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === 'home');
    });
    
    // ============================================================
    //  RENDER (DATA KOSONG TETAP DI-RENDER)
    // ============================================================
    renderDecks();
    updateHome();
    
    // ============================================================
    //  ADMIN UI
    // ============================================================
    const adminBadge = document.getElementById('admin-badge');
    if (adminBadge) adminBadge.classList.toggle('hidden', !isAdmin);
    
    const adminImportBtn = document.getElementById('admin-import-btn');
    if (adminImportBtn) adminImportBtn.classList.toggle('hidden', !isAdmin);
    
    const userRequestBtn = document.getElementById('user-request-btn');
    if (userRequestBtn) userRequestBtn.classList.toggle('hidden', isAdmin);
    
    const proBadge = document.getElementById('pro-badge');
    if (proBadge) {
        const isPremium = isPremiumActive();
        if (isPremium && !isAdmin) {
            proBadge.classList.remove('hidden');
            proBadge.textContent = '⭐ PRO';
        } else {
            proBadge.classList.add('hidden');
        }
    }
    
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

// ============================================================
//  SHOW LOGIN PAGE - HANYA 1 VERSI
// ============================================================

function showLoginPage() {
    console.log('🔐 Showing login page');
    
    resetAppState();
    
    // ===== HIDE ALL VIEWS =====
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
        v.style.display = 'none';
    });
    
    // ===== SHOW LOGIN =====
    const loginView = document.getElementById('view-login');
    if (loginView) {
        loginView.classList.add('active');
        loginView.style.display = 'flex';
    }
    
    // ===== HIDE NAV =====
    const bottomNav = document.getElementById('bottomNav');
    if (bottomNav) {
        bottomNav.style.display = 'none';
    }
    
    // ===== CLEAR SESSION =====
    clearSession();
    
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

function resetAppState() {
    bootstrapped = false;
    initDone = false;
    appEntered = false;
    authReady = false;
    dataReady = false;
    dataHealthy = true;
    currentUser = null;
    allCards = [];
    userPlan = 'free';
    isAdmin = false;
    isLoadingData = false;
}
