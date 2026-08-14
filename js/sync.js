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
                        // 1. AMBIL LOCAL PROGRESS
                        // ====================================================

                        const cached = await loadFromIndexedDB(email);

                        if (
                            !cached ||
                            !Array.isArray(cached.cards)
                        ) {
                            console.log('ℹ️ No local progress to sync');
                            updateSyncStatus('', 'Synced');
                            return;
                        }

                        const localCards = cached.cards;

                        console.log(
                            '📦 Local progress:',
                            localCards.length,
                            'cards'
                        );

                        // ====================================================
                        // 2. AMBIL CLOUD TERBARU
                        // ====================================================
                        //
                        // Jangan langsung overwrite cloud.
                        // Cloud harus dibandingkan PER CARD.
                        // ====================================================

                        let cloudData = null;

                        try {
                            const cloudDoc = await db
                                .collection('users')
                                .doc(email)
                                .get();

                            if (cloudDoc.exists) {
                                cloudData = cloudDoc.data();

                                console.log(
                                    '☁️ Cloud progress:',
                                    Array.isArray(cloudData.cards)
                                        ? cloudData.cards.length
                                        : 0,
                                    'cards'
                                );
                            } else {
                                console.log(
                                    '☁️ No cloud document yet'
                                );
                            }

                        } catch (cloudError) {
                            console.warn(
                                '⚠️ Failed to read cloud:',
                                cloudError.message
                            );

                            throw cloudError;
                        }

                        const cloudCards =
                            cloudData &&
                            Array.isArray(cloudData.cards)
                                ? cloudData.cards
                                : [];

                        // ====================================================
                        // 3. MERGE PER CARD
                        // ====================================================

                        const localMap = new Map();

                        localCards.forEach(card => {
                            const key = card.__id || card.card_id;

                            if (key) {
                                localMap.set(key, card);
                            }
                        });

                        const cloudMap = new Map();

                        cloudCards.forEach(card => {
                            const key = card.__id || card.card_id;

                            if (key) {
                                cloudMap.set(key, card);
                            }
                        });

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
                            const localCard = localMap.get(key);
                            const cloudCard = cloudMap.get(key);

                            // Hanya ada di local
                            if (localCard && !cloudCard) {
                                mergedProgress.set(key, localCard);
                                localOnly++;
                                return;
                            }

                            // Hanya ada di cloud
                            if (!localCard && cloudCard) {
                                mergedProgress.set(key, cloudCard);
                                cloudOnly++;
                                return;
                            }

                            // Ada di keduanya → compare timestamp
                            const localTime =
                                Number(
                                    localCard.progress_updated_at || 0
                                );

                            const cloudTime =
                                Number(
                                    cloudCard.progress_updated_at || 0
                                );

                            if (localTime > cloudTime) {
                                mergedProgress.set(key, localCard);
                                localWins++;
                            } else {
                                mergedProgress.set(key, cloudCard);
                                cloudWins++;
                            }
                        });

                        const mergedCards =
                            Array.from(mergedProgress.values());

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
                        // 4. TENTUKAN APAKAH CLOUD PERLU DIUPDATE
                        // ====================================================

                        const cloudChanged =
                            localWins > 0 ||
                            localOnly > 0;

                        // ====================================================
                        // 5. JIKA CLOUD LEBIH BARU / SAMA
                        //    → JANGAN UPLOAD LOCAL LAMA
                        //    → UPDATE LOCAL DENGAN MERGED RESULT
                        // ====================================================

                        if (!cloudChanged) {

                            console.log(
                                '☁️ Cloud is same/newer → keeping cloud progress'
                            );

                            allCards = mergeProgress(
                                typeof loadSharedDecksOnce === 'function'
                                    ? await loadSharedDecksOnce()
                                    : [],
                                mergedCards
                            );

                            await saveToIndexedDB(email, {
                                cards: mergedCards,
                                plan:
                                    cloudData?.plan ||
                                    cached.plan ||
                                    'free',
                                schema_version:
                                    cloudData?.schema_version ||
                                    cached.schema_version ||
                                    CURRENT_SCHEMA_VERSION,
                                cloudUpdatedAt:
                                    cloudData?.last_updated ??
                                    cached.cloudUpdatedAt ??
                                    Date.now()
                            });

                            completed = true;
                            updateSyncStatus('', 'Synced');
                            return;
                        }

                        // ====================================================
                        // 6. LOCAL PUNYA PERUBAHAN TERBARU
                        //    → UPLOAD MERGED RESULT
                        // ====================================================

                        const saveTime = Date.now();

                        console.log(
                            '📤 Uploading merged progress:',
                            mergedCards.length,
                            'cards'
                        );

                        await db
                            .collection('users')
                            .doc(email)
                            .set({
                                cards: mergedCards,
                                plan:
                                    cached.plan ||
                                    cloudData?.plan ||
                                    'free',
                                schema_version:
                                    cached.schema_version ||
                                    cloudData?.schema_version ||
                                    CURRENT_SCHEMA_VERSION,
                                last_updated: saveTime
                            }, {
                                merge: true
                            });

                        // ====================================================
                        // 7. UPDATE LOCAL CACHE DENGAN HASIL FINAL
                        // ====================================================

                        await saveToIndexedDB(email, {
                            cards: mergedCards,
                            plan:
                                cached.plan ||
                                cloudData?.plan ||
                                'free',
                            schema_version:
                                cached.schema_version ||
                                cloudData?.schema_version ||
                                CURRENT_SCHEMA_VERSION,
                            cloudUpdatedAt: saveTime
                        });

                        allCards = mergeProgress(
                            typeof loadSharedDecksOnce === 'function'
                                ? await loadSharedDecksOnce()
                                : [],
                            mergedCards
                        );

                        console.log(
                            '☁️ Sync complete:',
                            mergedCards.length,
                            'cards'
                        );

                        completed = true;
                        updateSyncStatus('', 'Synced');

                    } catch (err) {
                        retries--;

                        console.warn(
                            `⚠️ Retry ${3 - retries}/3:`,
                            err.message
                        );

                        if (retries > 0) {
                            await new Promise(
                                resolve => setTimeout(resolve, 2000)
                            );
                        }
                    }
                }

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
        console.timeEnd('⏱️ performSync.total');
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
