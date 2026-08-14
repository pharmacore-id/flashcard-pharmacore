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

// ============================================================
// PERFORM SYNC - SIMPLE VERSION
//
// Cloud structure:
// users/{email}                  -> metadata
// users/{email}/progress/{id}   -> 1 progress/card
//
// IMPORTANT:
// - Tidak memanggil loadSharedDecksOnce()
// - Tidak upload semua kartu setiap sync
// - Hanya upload kartu yang local-nya lebih baru
// ============================================================

async function performSync({
    force = false,
    email = currentUser
} = {}) {

    console.time('⏱️ performSync.total');

    // ============================================================
    // 1. BASIC CHECK
    // ============================================================

    if (!email) {
        console.warn('⚠️ performSync: No email provided');
        console.timeEnd('⏱️ performSync.total');
        return;
    }

    if (!navigator.onLine) {
        console.log('📴 Offline, sync skipped');
        updateSyncStatus('offline', 'Offline');
        console.timeEnd('⏱️ performSync.total');
        return;
    }


    // ============================================================
    // 2. PREVENT MULTIPLE SYNC
    // ============================================================

    if (currentSyncPromise) {

        if (force) {
            console.log('⏳ Sync already running, waiting...');
            await currentSyncPromise;
        } else {
            console.log('⏳ Sync already in progress, skipping...');
        }

        console.timeEnd('⏱️ performSync.total');
        return;
    }


    console.log(
        '🔄 Performing sync...',
        force ? '(force)' : ''
    );

    updateSyncStatus('syncing', 'Syncing...');


    // ============================================================
    // 3. CREATE ONE SYNC PROMISE
    // ============================================================

    currentSyncPromise = (async () => {

        try {

            // ====================================================
            // 4. LOAD LOCAL
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

                return;
            }


            const localCards =
                cached.cards;


            console.log(
                '📦 Local progress:',
                localCards.length,
                'cards'
            );


            // ====================================================
            // 5. LOAD CLOUD PROGRESS
            // ====================================================

            const progressRef =
                db
                    .collection('users')
                    .doc(email)
                    .collection('progress');


            const snapshot =
                await progressRef.get();


            const cloudCards = [];


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


            // ====================================================
            // 6. CREATE MAPS
            // ====================================================

            const localMap =
                new Map();

            localCards.forEach(card => {

                if (
                    !card ||
                    typeof card !== 'object'
                ) {
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


            const cloudMap =
                new Map();

            cloudCards.forEach(card => {

                if (
                    !card ||
                    typeof card !== 'object'
                ) {
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
            // 7. COMPARE LOCAL VS CLOUD
            // ====================================================

            const mergedMap =
                new Map();

            const uploadMap =
                new Map();


            const allKeys =
                new Set([
                    ...localMap.keys(),
                    ...cloudMap.keys()
                ]);


            let localWins = 0;
            let cloudWins = 0;
            let localOnly = 0;
            let cloudOnly = 0;
            let unchanged = 0;


            allKeys.forEach(key => {

                const localCard =
                    localMap.get(key);

                const cloudCard =
                    cloudMap.get(key);


                // =================================================
                // LOCAL ONLY
                // =================================================

                if (localCard && !cloudCard) {

                    mergedMap.set(
                        key,
                        localCard
                    );

                    uploadMap.set(
                        key,
                        localCard
                    );

                    localOnly++;

                    return;
                }


                // =================================================
                // CLOUD ONLY
                // =================================================

                if (!localCard && cloudCard) {

                    mergedMap.set(
                        key,
                        cloudCard
                    );

                    cloudOnly++;

                    return;
                }


                // =================================================
                // BOTH EXIST
                // =================================================

                const localTime =
                    Number(
                        localCard?.progress_updated_at || 0
                    );

                const cloudTime =
                    Number(
                        cloudCard?.progress_updated_at || 0
                    );


                // -------------------------------------------------
                // LOCAL LEBIH BARU
                // -------------------------------------------------

                if (localTime > cloudTime) {

                    mergedMap.set(
                        key,
                        localCard
                    );

                    uploadMap.set(
                        key,
                        localCard
                    );

                    localWins++;

                    return;
                }


                // -------------------------------------------------
                // CLOUD LEBIH BARU
                // -------------------------------------------------

                if (cloudTime > localTime) {

                    mergedMap.set(
                        key,
                        cloudCard
                    );

                    cloudWins++;

                    return;
                }


                // -------------------------------------------------
                // SAMA
                // -------------------------------------------------

                mergedMap.set(
                    key,
                    localCard
                );

                unchanged++;

            });


            const mergedCards =
                Array.from(
                    mergedMap.values()
                );


            console.log(
                '🔀 Sync comparison:',
                {
                    localWins,
                    cloudWins,
                    localOnly,
                    cloudOnly,
                    unchanged,
                    upload: uploadMap.size,
                    merged: mergedCards.length
                }
            );


            // ====================================================
            // 8. UPLOAD ONLY CHANGED LOCAL DATA
            // ====================================================

            const uploadEntries =
                Array.from(
                    uploadMap.entries()
                );


            const BATCH_SIZE = 400;


            if (uploadEntries.length === 0) {

                console.log(
                    '☁️ Nothing to upload'
                );

            } else {

                console.log(
                    '📤 Uploading only changed progress:',
                    uploadEntries.length,
                    'cards'
                );


                for (
                    let start = 0;
                    start < uploadEntries.length;
                    start += BATCH_SIZE
                ) {

                    const chunk =
                        uploadEntries.slice(
                            start,
                            start + BATCH_SIZE
                        );


                    const batch =
                        db.batch();


                    chunk.forEach(
                        ([key, card]) => {

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
            }


            // ====================================================
            // 9. UPDATE LOCAL INDEXEDDB
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
            // 10. COMPLETE
            // ====================================================

            console.log(
                '☁️ Sync complete:',
                mergedCards.length,
                'progress cards'
            );


            updateSyncStatus(
                '',
                'Synced'
            );

        } catch (error) {

            console.error(
                '❌ Sync failed:',
                error
            );


            updateSyncStatus(
                'error',
                'Sync failed'
            );

        } finally {

            currentSyncPromise =
                null;
        }

    })();


    // ============================================================
    // 11. WAIT FOR THIS SYNC
    // ============================================================

    try {

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
