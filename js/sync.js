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

        console.log('🔄 Performing sync...', force ? '(force)' : '');
        updateSyncStatus('syncing', 'Syncing...');

        currentSyncPromise = (async () => {
            try {
                let retries = 3;
                let saved = false;

                while (retries > 0 && !saved) {
                    try {
                        // ===== AMBIL DATA TERBARU DARI INDEXEDDB =====
                        const cached = await loadFromIndexedDB(email);
                        if (!cached || !cached.cards || cached.cards.length === 0) {
                            console.log('ℹ️ No data to sync');
                            updateSyncStatus('', 'Synced');
                            return;
                        }

                        // ===== COMPARE TIMESTAMP (HANYA JIKA TIDAK FORCE) =====
                        if (!force) {
                            const local = cached.localProgressUpdatedAt ?? 0;
                            const cloud = cached.cloudUpdatedAt ?? 0;

                            console.log('📊 Timestamp comparison:', {
                                localProgressUpdatedAt: local,
                                cloudUpdatedAt: cloud,
                                diff: local - cloud
                            });

                            if (local <= cloud) {
                                console.log('✅ No local changes to sync');
                                updateSyncStatus('', 'Synced');
                                return;
                            }
                        }

                        console.log('📤 Uploading (', cached.cards.length, 'cards)...');

                        // ===== UPLOAD KE FIRESTORE =====
                        const saveTime = Date.now();

                        await db.collection('users').doc(email).set({
                            cards: cached.cards,
                            plan: cached.plan || 'free',
                            schema_version: cached.schema_version || CURRENT_SCHEMA_VERSION,
                            last_updated: saveTime
                        }, { merge: true });

                        saved = true;
                        console.log('☁️ Sync complete (', cached.cards.length, 'cards)');

                        // ===== UPDATE cloudUpdatedAt =====
                        await saveToIndexedDB(email, {
                            cloudUpdatedAt: saveTime
                        });
                        console.log('📦 cloudUpdatedAt updated');

                        updateSyncStatus('', 'Synced');

                    } catch (err) {
                        retries--;
                        console.warn(`⚠️ Retry ${3 - retries}/3:`, err.message);
                        if (retries > 0) {
                            await new Promise(r => setTimeout(r, 2000));
                        }
                    }
                }

                if (!saved) {
                    console.error('❌ Upload failed after 3 retries');
                    updateSyncStatus('error', 'Sync failed');
                    scheduleSync(5000);
                }

            } catch (error) {
                console.error('❌ Sync failed:', error);
                updateSyncStatus('error', 'Sync failed');
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
