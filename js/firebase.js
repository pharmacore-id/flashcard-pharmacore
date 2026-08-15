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

        let plan = 'free';
        let nickname = null;
        let schemaVersion = CURRENT_SCHEMA_VERSION;

        if (userDoc.exists) {

            const userData = userDoc.data();

            plan = userData.plan || 'free';

            nickname =
                userData.nickname || null;

            schemaVersion =
                userData.schema_version ||
                CURRENT_SCHEMA_VERSION;

            if (nickname) {
                localStorage.setItem(
                    NICKNAME_KEY + email,
                    nickname
                );
            }
        }

        // ============================================================
        // 2. LOAD USER PROGRESS
        //
        // users/{email}/progress/{cardId}
        // ============================================================

        const progressSnapshot =
            await userRef
                .collection('progress')
                .get();

        const progressCards = [];

        progressSnapshot.forEach(doc => {

            const data = doc.data();

            if (!data) return;

            progressCards.push({
                __id: data.__id || doc.id,
                ...data
            });
        });

        console.log(
            '☁️ Firebase progress loaded:',
            progressCards.length,
            'cards'
        );

        // ============================================================
        // 3. RETURN CLOUD DATA
        // ============================================================

        return {
            cards: progressCards,

            plan: plan,

            schema_version:
                schemaVersion,

            last_updated:
                Date.now()
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
