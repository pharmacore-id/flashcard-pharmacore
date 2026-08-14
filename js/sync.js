async function flushSaveNow(email) {
    console.time('⏱️ flushSaveNow.total');  // ← TAMBAHKAN
    
    if (!email) {
        console.warn('⚠️ flushSaveNow: No email provided');
        console.timeEnd('⏱️ flushSaveNow.total');
        return;
    }
    
    if (!allCards || allCards.length === 0) {
        console.warn('⚠️ flushSaveNow skipped: allCards is empty');
        console.timeEnd('⏱️ flushSaveNow.total');
        return;
    }
    
    console.log('📤 Flush save (force sync)...');
    
    await performSync({
        force: true,
        email: email
    });
    
    console.timeEnd('⏱️ flushSaveNow.total');  // ← TAMBAHKAN
}

// ===== SCHEDULE SYNC (DEBOUNCE) =====
function scheduleSync(debounceMs = 3000) {
    if (syncTimeout) {
        clearTimeout(syncTimeout);
        syncTimeout = null;
    }
    
    syncTimeout = setTimeout(() => {
        syncTimeout = null;
        performSync();
    }, debounceMs);
}

// ===== PERFORM SYNC - SATU-SATUNYA UPLOADER =====
// ============================================================
// PERFORM SYNC
// Cloud structure:
// users/{email}                  -> metadata
// users/{email}/progress/{id}   -> 1 progress/card
// ============================================================

async function performSync({
    force = false,
    email = currentUser
} = {}) {
    console.time('⏱️ performSync.total');

    try {
        if (!email) {
            console.warn('⚠️ performSync: No email provided');
            return;
        }

        // ===== JIKA SYNC SEDANG BERJALAN =====
        if (currentSyncPromise) {
            if (force) {
                console.log('⏳ Sync in progress, waiting...');
                await currentSyncPromise;
                return performSync({ force: true, email });
            }

            console.log('⏳ Sync already in progress, skipping...');
            return;
        }

        // ===== CEK ONLINE =====
        if (!navigator.onLine) {
            console.log('📴 Offline, sync skipped');
            updateSyncStatus('offline', 'Offline');
            return;
        }

        console.log(
            '🔄 Performing sync...',
            force ? '(force)' : ''
        );

        updateSyncStatus('syncing', 'Syncing...');

        currentSyncPromise = (async () => {
            try {
                let retries = 3;
                let completed = false;

                while (retries > 0 && !completed) {
                    try {

                        // ====================================================
                        // 1. AMBIL LOCAL PROGRESS DARI INDEXEDDB
                        // ====================================================

                        const cached =
                            await loadFromIndexedDB(email);

                        if (
                            !cached ||
                            !Array.isArray(cached.cards)
                        ) {
                            console.log(
                                'ℹ️ No local progress to sync'
                            );

                            updateSyncStatus('', 'Synced');
                            completed = true;
                            return;
                        }

                        const localCards = cached.cards;

                        console.log(
                            '📦 Local progress:',
                            localCards.length,
                            'cards'
                        );


                        // ====================================================
                        // 2. AMBIL CLOUD PROGRESS
                        // ====================================================
                        //
                        // TIDAK lagi membaca:
                        //
                        // users/{email}.cards
                        //
                        // Progress sekarang berada di:
                        //
                        // users/{email}/progress/{cardId}
                        // ====================================================

                        const progressRef = db
                            .collection('users')
                            .doc(email)
                            .collection('progress');

                        let cloudCards = [];

                        try {

                            const snapshot =
                                await progressRef.get();

                            snapshot.forEach(doc => {

                                const data = doc.data();

                                if (data) {
                                    cloudCards.push({
                                        __id:
                                            data.__id ||
                                            doc.id,
                                        ...data
                                    });
                                }

                            });

                            console.log(
                                '☁️ Cloud progress:',
                                cloudCards.length,
                                'cards'
                            );

                        } catch (cloudError) {

                            console.warn(
                                '⚠️ Failed to read cloud progress:',
                                cloudError.message
                            );

                            throw cloudError;
                        }


                        // ====================================================
                        // 3. BUAT MAP LOCAL
                        // ====================================================

                        const localMap = new Map();

                        localCards.forEach(card => {

                            if (!card || typeof card !== 'object') {
                                return;
                            }

                            const key =
                                card.__id ||
                                card.card_id;

                            if (key) {
                                localMap.set(
                                    String(key),
                                    card
                                );
                            }
                        });


                        // ====================================================
                        // 4. BUAT MAP CLOUD
                        // ====================================================

                        const cloudMap = new Map();

                        cloudCards.forEach(card => {

                            if (!card || typeof card !== 'object') {
                                return;
                            }

                            const key =
                                card.__id ||
                                card.card_id;

                            if (key) {
                                cloudMap.set(
                                    String(key),
                                    card
                                );
                            }
                        });


                        // ====================================================
                        // 5. MERGE LOCAL + CLOUD
                        // ====================================================

                        const mergedProgress = new Map();

                        const allKeys = new Set([
                            ...localMap.keys(),
                            ...cloudMap.keys()
                        ]);

                        let localWins = 0;
                        let cloudWins = 0;
                        let localOnly = 0;
                        let cloudOnly = 0;

                        allKeys.forEach(key => {

                            const localCard =
                                localMap.get(key);

                            const cloudCard =
                                cloudMap.get(key);


                            // -----------------------------
                            // HANYA ADA DI LOCAL
                            // -----------------------------

                            if (localCard && !cloudCard) {

                                mergedProgress.set(
                                    key,
                                    localCard
                                );

                                localOnly++;

                                return;
                            }


                            // -----------------------------
                            // HANYA ADA DI CLOUD
                            // -----------------------------

                            if (!localCard && cloudCard) {

                                mergedProgress.set(
                                    key,
                                    cloudCard
                                );

                                cloudOnly++;

                                return;
                            }


                            // -----------------------------
                            // ADA DI KEDUANYA
                            // -----------------------------

                            const localTime =
                                Number(
                                    localCard
                                        ?.progress_updated_at || 0
                                );

                            const cloudTime =
                                Number(
                                    cloudCard
                                        ?.progress_updated_at || 0
                                );


                            if (localTime > cloudTime) {

                                mergedProgress.set(
                                    key,
                                    localCard
                                );

                                localWins++;

                            } else {

                                mergedProgress.set(
                                    key,
                                    cloudCard
                                );

                                cloudWins++;
                            }
                        });


                        const mergedCards =
                            Array.from(
                                mergedProgress.values()
                            );


                        console.log(
                            '🔀 Progress conflict resolution:',
                            {
                                localWins,
                                cloudWins,
                                localOnly,
                                cloudOnly,
                                merged: mergedCards.length
                            }
                        );


                        // ====================================================
                        // 6. UPLOAD PROGRESS PER DOCUMENT
                        // ====================================================
                        //
                        // Firestore batch maksimal 500 writes.
                        // Kita gunakan 400 supaya ada margin aman.
                        // ====================================================

                        const BATCH_SIZE = 400;

                        const mergedEntries =
                            Array.from(
                                mergedProgress.entries()
                            );

                        console.log(
    '📤 Preparing progress upload:',
    mergedCards.length,
    'cards'
);

                        // ----------------------------------------------------
                        // Upload batches
                        // ----------------------------------------------------

                        for (
                            let start = 0;
                            start < mergedEntries.length;
                            start += BATCH_SIZE
                        ) {

                            const batch =
                                db.batch();

                            const chunk =
                                mergedEntries.slice(
                                    start,
                                    start + BATCH_SIZE
                                );


                            chunk.forEach(
                                ([key, card]) => {

                                    // Firestore document ID
                                    // tidak boleh mengandung '/'
                                    const safeId =
                                        String(key)
                                            .replaceAll(
                                                '/',
                                                '_'
                                            );


                                    const docRef =
                                        progressRef.doc(
                                            safeId
                                        );


                                    batch.set(
                                        docRef,
                                        card,
                                        {
                                            merge: true
                                        }
                                    );
                                }
                            );


                            console.log(
                                `📤 Uploading batch ${
                                    Math.floor(
                                        start / BATCH_SIZE
                                    ) + 1
                                }`,
                                chunk.length,
                                'cards'
                            );


                            await batch.commit();
                        }


                        // ====================================================
                        // 7. UPDATE LOCAL INDEXEDDB
                        // ====================================================

                        const saveTime =
                            Date.now();

                        await saveToIndexedDB(
                            email,
                            {
                                cards:
                                    mergedCards,

                                plan:
                                    cached.plan ||
                                    'free',

                                schema_version:
                                    cached.schema_version ||
                                    CURRENT_SCHEMA_VERSION,

                                cloudUpdatedAt:
                                    saveTime
                            }
                        );


                      // ====================================================
// 8. SYNC COMPLETE
// ====================================================

console.log(
    '☁️ Sync complete:',
    mergedCards.length,
    'progress cards'
);

completed = true;

updateSyncStatus(
    '',
    'Synced'
);


                    } catch (err) {

                        retries--;

                        console.warn(
                            `⚠️ Retry ${
                                3 - retries
                            }/3:`,
                            err.message
                        );


                        if (retries > 0) {

                            await new Promise(
                                resolve =>
                                    setTimeout(
                                        resolve,
                                        2000
                                    )
                            );
                        }
                    }
                }


                // ====================================================
                // 9. SEMUA RETRY GAGAL
                // ====================================================

                if (!completed) {

                    console.error(
                        '❌ Sync failed after 3 retries'
                    );

                    updateSyncStatus(
                        'error',
                        'Sync failed'
                    );

                    scheduleSync(5000);
                }


            } catch (error) {

                console.error(
                    '❌ Sync failed:',
                    error
                );

                updateSyncStatus(
                    'error',
                    'Sync failed'
                );

                scheduleSync(5000);


            } finally {

                currentSyncPromise = null;
            }

        })();


        await currentSyncPromise;


    } finally {

        console.timeEnd(
            '⏱️ performSync.total'
        );
    }
}

function updateSyncStatus(status, text) {
    const dotIds = ['sync-dot', 'sync-dot-home', 'sync-dot-signup'];
    const textIds = ['sync-text', 'sync-text-home', 'sync-text-signup'];
    
    dotIds.forEach(id => {
        const dot = document.getElementById(id);
        if (dot) {
            dot.className = 'dot';
            if (status === 'syncing') dot.classList.add('syncing');
            else if (status === 'offline') dot.classList.add('offline');
        }
    });
    
    textIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = text || 'Synced';
    });
}

 // ============================================================
//  FLUSH ON TAB HIDDEN (Bonus)
// ============================================================

document.addEventListener('visibilitychange', () => {
  if (document.hidden && currentUser) {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    flushSaveNow(currentUser);
  }
});
