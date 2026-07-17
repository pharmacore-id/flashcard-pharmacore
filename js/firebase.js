// ============================================================
    //  FIREBASE CONFIG
    // ============================================================
    const firebaseConfig = {
      apiKey: "AIzaSyB0m9NM3IxyQJuLEl9_C5C7aI-I-7BndsQ",
      authDomain: "pharmacore-flashcards.firebaseapp.com",
      projectId: "pharmacore-flashcards",
      storageBucket: "pharmacore-flashcards.firebasestorage.app",
      messagingSenderId: "483421707823",
      appId: "1:483421707823:web:912254896fc1ba4d4e70da",
      measurementId: "G-DF38PK97GW"
    };

    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const functions = firebase.app().functions('asia-southeast2');
    const auth = firebase.auth();

async function loadFromFirebase(email) {
    console.time('⏱️ firestore.load');
    try {
        if (!email || !navigator.onLine) return null;
        
        // ===== FIRESTORE QUERY =====
        updateSyncStatus('syncing', 'Loading...');

        const userDoc = await db.collection('users').doc(email).get();
        
        if (!userDoc.exists) return null;

        const data = userDoc.data();
        
        if (data.nickname) {
            localStorage.setItem(NICKNAME_KEY + email, data.nickname);
        }

        // ============================================================
        //  HANYA AMBIL PROGRESS DARI FIRESTORE
        //  JANGAN MERGE DENGAN SHARED DECKS DI SINI!
        // ============================================================
        const progressCards = data.cards || [];
        
        console.log('✅ User data loaded from Firebase (progress only):', progressCards.length, 'cards');

        const plan = data.plan || 'free';
        const schemaVersion = data.schema_version || 1;

        return {
            cards: progressCards,  // ← PROGRESS ONLY!
            plan: plan,
            last_updated: data.last_updated || data.updatedAt?.toMillis?.() || Date.now(),
            schema_version: schemaVersion
        };

    } catch (err) {
        console.warn('⚠️ Firebase load failed:', err.message);
        updateSyncStatus('offline', 'Offline');
        return null;
    } finally {
        console.timeEnd('⏱️ firestore.load');
    }
}

