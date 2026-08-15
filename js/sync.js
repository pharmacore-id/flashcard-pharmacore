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
// INCREMENTAL SYNC METADATA
// ============================================================

async function getProgressSyncMeta(email) {
    if (!email) return null;

    try {
        const ref = db.collection('users').doc(email);
        const snap = await ref.get();

        if (!snap.exists) return null;

        const data = snap.data() || {};

        return {
            progress_sync_at:
                Number(data.progress_sync_at || 0)
        };

    } catch (error) {
        console.warn('⚠️ Failed to load sync metadata:', error);
        return null;
    }
}


async function saveProgressSyncMeta(email, timestamp) {
    if (!email) return;

    try {
        await db.collection('users').doc(email).set({
            progress_sync_at: timestamp
        }, {
            merge: true
        });

    } catch (error) {
        console.warn(
            '⚠️ Failed to save sync metadata:',
            error
        );
    }
}

// ============================================================
// PERFORM SYNC - SIMPLE VERSION
// ============================================================

async function performSync({
    force = false,
    email = currentUser
} = {}) {

    console.time('⏱️ performSync.total');

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


    currentSyncPromise = (async () => {

        try {

            // ====================================================
            // 1. LOAD LOCAL PROGRESS
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
            // 2. LOAD LAST SYNC CHECKPOINT
            // ====================================================

            const syncMeta =
                await getProgressSyncMeta(email);

            const lastSyncAt =
                Number(
                    syncMeta?.progress_sync_at ||
                    cached.cloudUpdatedAt ||
                    0
                );

            console.log(
                '🕐 Last progress sync:',
                lastSyncAt
                    ? new Date(lastSyncAt).toISOString()
                    : 'NEVER'
            );


            // ====================================================
            // 3. PROGRESS COLLECTION
            // ====================================================

            const progressRef =
                db
                    .collection('users')
                    .doc(email)
                    .collection('progress');


            // ====================================================
            // 4. LOAD ONLY CHANGED CLOUD PROGRESS
            // ====================================================

            let cloudCards = [];
            let isInitialSync = !lastSyncAt;

            if (isInitialSync) {

                console.log(
                    '🆕 Initial sync → loading all cloud progress'
                );

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

            } else {

                console.log(
                    '⚡ Incremental sync → loading changed progress only'
                );

                const snapshot =
                    await progressRef
                        .where(
                            'progress_updated_at',
                            '>',
                            lastSyncAt
                        )
                        .get();

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
            }


            console.log(
                '☁️ Cloud progress loaded:',
                cloudCards.length,
                'cards'
            );


            // ====================================================
            // 5. CREATE MAPS
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
            // 6. MERGE
            // ====================================================

            const mergedMap =
                new Map();

            const uploadMap =
                new Map();


            // ====================================================
            // IMPORTANT
            //
            // Initial sync:
            // compare ALL local/cloud.
            //
            // Incremental sync:
            // only cloud-changed cards need comparison.
            // Local-only cards still need upload.
            // ====================================================

            if (isInitialSync) {

                const allKeys =
                    new Set([
                        ...localMap.keys(),
                        ...cloudMap.keys()
                    ]);

                allKeys.forEach(key => {

                    const localCard =
                        localMap.get(key);

                    const cloudCard =
                        cloudMap.get(key);


                    if (localCard && !cloudCard) {

                        mergedMap.set(
                            key,
                            localCard
                        );

                        uploadMap.set(
                            key,
                            localCard
                        );

                        return;
                    }


                    if (!localCard && cloudCard) {

                        mergedMap.set(
                            key,
                            cloudCard
                        );

                        return;
                    }


                    const localTime =
                        Number(
                            localCard?.progress_updated_at || 0
                        );

                    const cloudTime =
                        Number(
                            cloudCard?.progress_updated_at || 0
                        );


                    if (localTime > cloudTime) {

                        mergedMap.set(
                            key,
                            localCard
                        );

                        uploadMap.set(
                            key,
                            localCard
                        );

                    } else {

                        mergedMap.set(
                            key,
                            cloudCard
                        );

                    }

                });

            } else {

                // ==================================================
                // INCREMENTAL
                // ==================================================

                // Mulai dari seluruh local data.
                localMap.forEach((card, key) => {
                    mergedMap.set(key, card);
                });


                // Hanya cloud-changed cards dibandingkan.
                cloudMap.forEach((cloudCard, key) => {

                    const localCard =
                        localMap.get(key);


                    if (!localCard) {

                        mergedMap.set(
                            key,
                            cloudCard
                        );

                        return;
                    }


                    const localTime =
                        Number(
                            localCard.progress_updated_at || 0
                        );

                    const cloudTime =
                        Number(
                            cloudCard.progress_updated_at || 0
                        );


                    if (cloudTime > localTime) {

                        mergedMap.set(
                            key,
                            cloudCard
                        );

                    } else if (localTime > cloudTime) {

                        mergedMap.set(
                            key,
                            localCard
                        );

                        uploadMap.set(
                            key,
                            localCard
                        );

                    } else {

                        mergedMap.set(
                            key,
                            localCard
                        );

                    }

                });


                // ==================================================
                // LOCAL-ONLY / LOCAL-NEWER
                //
                // Hanya upload jika local timestamp lebih baru
                // dari checkpoint.
                // ==================================================

                localMap.forEach((localCard, key) => {

                    const localTime =
                        Number(
                            localCard.progress_updated_at || 0
                        );

                    if (
                        localTime > lastSyncAt
                    ) {

                        const cloudCard =
                            cloudMap.get(key);

                        const cloudTime =
                            Number(
                                cloudCard?.progress_updated_at || 0
                            );


                        if (
                            !cloudCard ||
                            localTime > cloudTime
                        ) {

                            uploadMap.set(
                                key,
                                localCard
                            );

                        }

                    }

                });

            }


            const mergedCards =
                Array.from(
                    mergedMap.values()
                );


            console.log(
                '🔀 Sync comparison:',
                {
                    initial: isInitialSync,
                    cloudChanged: cloudCards.length,
                    upload: uploadMap.size,
                    merged: mergedCards.length
                }
            );


            // ====================================================
            // 7. UPLOAD CHANGED LOCAL DATA
            // ====================================================

            const uploadEntries =
                Array.from(
                    uploadMap.entries()
                );


            const BATCH_SIZE = 400;


            if (
                uploadEntries.length === 0
            ) {

                console.log(
                    '☁️ Nothing to upload'
                );

            } else {

                console.log(
                    '📤 Uploading changed progress:',
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
            // 8. CREATE NEW SYNC CHECKPOINT
            // ====================================================

            const newSyncAt =
                Date.now();


            // ====================================================
            // 9. SAVE MERGED DATA LOCALLY
            // ====================================================

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
                        newSyncAt
                }
            );


            // ====================================================
            // 10. SAVE CLOUD CHECKPOINT
            // ====================================================

            await saveProgressSyncMeta(
                email,
                newSyncAt
            );


            // ====================================================
            // 11. COMPLETE
            // ====================================================

            console.log(
                '☁️ Sync complete:',
                mergedCards.length,
                'progress cards'
            );

            console.log(
                '🕐 New sync checkpoint:',
                new Date(newSyncAt).toISOString()
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
