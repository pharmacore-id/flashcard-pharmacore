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
        if (!email || !navigator.onLine) {
            return null;
        }

        updateSyncStatus('syncing', 'Loading...');

        // ============================================================
        // 1. LOAD USER METADATA
        // ============================================================

        const userRef = db
            .collection('users')
            .doc(email);

        const userDoc = await userRef.get();

        const userData = userDoc.exists
            ? userDoc.data()
            : {};

        // Simpan nickname kalau ada
        if (userData.nickname) {
            localStorage.setItem(
                NICKNAME_KEY + email,
                userData.nickname
            );
        }

        // ============================================================
        // 2. LOAD USER PROGRESS
        //
        // Struktur Firestore:
        //
        // users/{email}/progress/{cardId}
        //
        // ============================================================

        const progressRef = userRef.collection('progress');

        const snapshot = await progressRef.get();

        const progressCards = [];

        snapshot.forEach(doc => {
            const data = doc.data();

            if (data) {
                progressCards.push({
                    __id: data.__id || doc.id,
                    ...data
                });
            }
        });

        console.log(
            '✅ User progress loaded from Firebase:',
            progressCards.length,
            'cards'
        );

        // ============================================================
        // 3. USER METADATA
        // ============================================================

        const plan =
            userData.plan ||
            'free';

        const schemaVersion =
            userData.schema_version ||
            CURRENT_SCHEMA_VERSION;

        const lastUpdated =
            userData.last_updated ||
            userData.updatedAt?.toMillis?.() ||
            Date.now();

        // ============================================================
        // 4. RETURN PROGRESS ONLY
        //
        // Shared library akan digabung di loadUserData()
        // ============================================================

        return {
            cards: progressCards,
            plan: plan,
            last_updated: lastUpdated,
            schema_version: schemaVersion
        };

    } catch (err) {

        console.warn(
            '⚠️ Firebase load failed:',
            err.message
        );

        updateSyncStatus(
            'offline',
            'Offline'
        );

        return null;

    } finally {

        console.timeEnd(
            '⏱️ firestore.load'
        );
    }
}
