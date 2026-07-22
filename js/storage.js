function getDB() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                
                // ===== STORE 1: user_data =====
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'email' });
                    log('✅ IndexedDB store created: user_data');
                }
                
                // ===== STORE 2: sync_queue (untuk future) =====
                if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
                    const queueStore = db.createObjectStore(SYNC_QUEUE_STORE, { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    queueStore.createIndex('email', 'email', { unique: false });
                    queueStore.createIndex('timestamp', 'timestamp', { unique: false });
                    queueStore.createIndex('synced', 'synced', { unique: false });
                    log('✅ IndexedDB store created: sync_queue');
                }
            };
            
            request.onsuccess = (e) => {
                const db = e.target.result;
                db.onversionchange = () => {
                    db.close();
                    log('🔄 Version change, closing...');
                };
                log('✅ IndexedDB opened');
                resolve(db);
            };
            
            request.onerror = (e) => {
                console.error('❌ IndexedDB error:', e.target.error);
                reject(e.target.error);
            };
            
            request.onblocked = () => {
                console.warn('⚠️ IndexedDB blocked. Please close other tabs.');
            };
        });
    }
    return dbPromise;
}

// ============================================================
//  SAVE TO INDEXEDDB - DENGAN TIMESTAMP TRACKING
// ============================================================

async function saveToIndexedDB(email, data) {
    if (!email) {
        console.warn('⚠️ saveToIndexedDB: No email provided');
        return null;
    }
    
    try {
        const db = await getDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        const existing = await new Promise((resolve) => {
            const request = store.get(email);
            request.onsuccess = () => resolve(request.result);
        });
        
        const now = Date.now();
        
        const record = {
            email,
            ...existing,
            ...data,
            createdAt: existing?.createdAt ?? data.createdAt ?? now,
            schema_version: data.schema_version ?? existing?.schema_version ?? CURRENT_SCHEMA_VERSION,
            updatedAt: now,
            localProgressUpdatedAt: data.markProgressUpdated
                ? now
                : (existing?.localProgressUpdatedAt ?? null),
            cloudUpdatedAt: data.cloudUpdatedAt ?? existing?.cloudUpdatedAt ?? null
        };
        
        // ===== HAPUS FIELD INTERNAL =====
        delete record._forceDirty;
        delete record._tempFlag;
        delete record.markProgressUpdated;
        
        store.put(record);
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => {
                log(`✅ IndexedDB saved: ${email}`);
                resolve(record);
            };
            tx.onerror = () => {
                console.error('❌ IndexedDB save error:', tx.error);
                reject(tx.error);
            };
        });
        
    } catch (error) {
        console.error('❌ saveToIndexedDB error:', error);
        throw error;
    }
}
// ============================================================
//  LOAD
// ============================================================

async function loadFromIndexedDB(email) {
    if (!email) {
        console.warn('⚠️ loadFromIndexedDB: No email provided');
        return null;
    }
    
    try {
        const db = await getDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.get(email);
            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    log(`✅ IndexedDB loaded: ${email}`);
                    resolve(result);
                } else {
                    log(`ℹ️ No data for: ${email}`);
                    resolve(null);
                }
            };
            request.onerror = () => {
                console.error('❌ IndexedDB load error:', request.error);
                reject(request.error);
            };
        });
        
    } catch (error) {
        console.error('❌ loadFromIndexedDB error:', error);
        return null;
    }
}

// ============================================================
//  HAS (CHECK EXISTING)
// ============================================================

async function hasIndexedDB(email) {
    const data = await loadFromIndexedDB(email);
    return data !== null;
}

// ============================================================
//  DELETE
// ============================================================

async function deleteFromIndexedDB(email) {
    if (!email) {
        console.warn('⚠️ deleteFromIndexedDB: No email provided');
        return;
    }
    
    try {
        const db = await getDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(email);
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => {
                log(`🗑️ IndexedDB deleted: ${email}`);
                resolve();
            };
            tx.onerror = () => {
                console.error('❌ IndexedDB delete error:', tx.error);
                reject(tx.error);
            };
        });
        
    } catch (error) {
        console.error('❌ deleteFromIndexedDB error:', error);
    }
}

// ============================================================
//  UPDATE FIELDS - TANPA REWRITE SELURUH DATA
// ============================================================

async function updateFields(email, fields) {
    if (!email || !fields) {
        console.warn('⚠️ updateFields: Missing email or fields');
        return;
    }
    
    try {
        const db = await getDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        // ===== AMBIL DATA LAMA =====
        const existing = await new Promise((resolve) => {
            const request = store.get(email);
            request.onsuccess = () => resolve(request.result);
        });
        
        if (!existing) {
            console.warn(`⚠️ No data found for ${email}`);
            return;
        }
        
        // ===== UPDATE HANYA FIELD YANG DISEBUTKAN =====
        const record = {
            ...existing,
            ...fields,
            updatedAt: Date.now()
        };
        
        store.put(record);
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => {
                log(`✅ Fields updated: ${email}`, Object.keys(fields));
                resolve(record);
            };
            tx.onerror = () => {
                console.error('❌ updateFields error:', tx.error);
                reject(tx.error);
            };
        });
        
    } catch (error) {
        console.error('❌ updateFields error:', error);
        throw error;
    }
}

// ============================================================
//  UPDATE SYNC STATUS DI INDEXEDDB
//  Memakai updateFields() yang sudah ada
// ============================================================

async function updateIndexedDBSyncStatus(email, status) {
    if (!email) {
        console.warn('⚠️ updateIndexedDBSyncStatus: No email provided');
        return;
    }
    
    try {
        await updateFields(email, {
            syncStatus: status
        });
        console.log(`✅ Sync status updated in IndexedDB: ${email} -> ${status}`);
    } catch (error) {
        console.error('❌ updateIndexedDBSyncStatus error:', error);
    }
}

// ============================================================
//  GET ALL (UNTUK DEBUGGING)
// ============================================================

async function getAllIndexedDB() {
    try {
        const db = await getDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const results = request.result || [];
                log(`📊 Total records: ${results.length}`);
                resolve(results);
            };
            request.onerror = () => {
                console.error('❌ getAll error:', request.error);
                reject(request.error);
            };
        });
        
    } catch (error) {
        console.error('❌ getAllIndexedDB error:', error);
        return [];
    }
}

// ============================================================
//  CLEAR STORE
// ============================================================

async function clearStore() {
    try {
        const db = await getDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => {
                log('🗑️ IndexedDB cleared');
                resolve();
            };
            tx.onerror = () => {
                console.error('❌ clear error:', tx.error);
                reject(tx.error);
            };
        });
        
    } catch (error) {
        console.error('❌ clearStore error:', error);
    }
}

// ============================================================
//  GET PENDING RECORDS (UNTUK FUTURE SYNC)
// ============================================================

async function getPendingRecords() {
    if (!DEBUG) {
        console.warn('⚠️ getPendingRecords only available in debug mode');
        return [];
    }
    
    try {
        const allRecords = await getAllIndexedDB();
        const pending = allRecords.filter(r => r.syncStatus === 'pending');
        log(`📤 Pending records: ${pending.length}`);
        return pending;
        
    } catch (error) {
        console.error('❌ getPendingRecords error:', error);
        return [];
    }
}

// ============================================================
//  MARK AS SYNCED (UNTUK FUTURE SYNC)
// ============================================================

async function markAsSynced(email) {
    if (!email) return;
    
    try {
        await updateFields(email, {
            syncStatus: 'synced',
            lastSync: Date.now(),
            errorCount: 0,
            lastError: null
        });
        log(`✅ Marked as synced: ${email}`);
    } catch (error) {
        console.error('❌ Failed to mark as synced:', error);
    }
}

async function markAsPending(email) {
    if (!email) return;
    await updateFields(email, {
        syncStatus: 'pending'
    });
}

async function markAsError(email, errorMessage) {
    if (!email) return;
    
    try {
        const current = await loadFromIndexedDB(email);
        const errorCount = (current?.errorCount ?? 0) + 1;
        
        await updateFields(email, {
            syncStatus: 'error',
            lastError: errorMessage,
            errorCount: errorCount
        });
        
        console.warn(`⚠️ Marked as error: ${email} - ${errorMessage}`);
    } catch (error) {
        console.error('❌ Failed to mark as error:', error);
    }
}

// ===== MIGRASI LOCALSTORAGE → INDEXEDDB =====
async function migrateLocalStorageToIndexedDB(email) {
    if (!email) return;
    
    if (getMigrationFlag(email)) {
        console.log('✅ Migration already done for:', email);
        return;
    }

    console.log('🔄 Starting migration for:', email);

    try {
        // ===== CEK: INDEXEDDB SUDAH ADA DATA DENGAN SCHEMA YANG CUKUP =====
        const existing = await loadFromIndexedDB(email);
        if (
            existing &&
            existing.cards &&
            existing.cards.length > 0 &&
            (existing.schema_version || 0) >= CURRENT_SCHEMA_VERSION
        ) {
            console.log('📦 IndexedDB already has data with valid schema, skipping migration.');
            setMigrationFlag(email);
            return;
        }

        const raw = localStorage.getItem(DATA_PREFIX + email);
        if (!raw) {
            console.log('ℹ️ No localStorage data found for:', email);
            setMigrationFlag(email);
            return;
        }

        const localData = JSON.parse(raw);
        if (!localData.cards || localData.cards.length === 0) {
            console.log('ℹ️ No cards in localStorage for:', email);
            setMigrationFlag(email);
            return;
        }

        console.log(`📦 Found ${localData.cards.length} cards in localStorage`);

        await saveToIndexedDB(email, {
            cards: localData.cards,
            plan: localData.user_plan || 'free',
            schema_version: localData.schema_version || CURRENT_SCHEMA_VERSION,
            cloudUpdatedAt: localData.last_updated ?? null
        });

        // ===== VERIFIKASI =====
        const verify = await loadFromIndexedDB(email);
        let verified = false;
        
        if (verify && verify.cards) {
            const localCards = localData.cards;
            const cachedCards = verify.cards;
            
            // 1. Cek jumlah
            if (cachedCards.length === localCards.length) {
                // 2. Cek ID pertama, tengah, terakhir
                const checkIndices = [
                    0,
                    Math.floor(localCards.length / 2),
                    localCards.length - 1
                ];
                
                let matchCount = 0;
                for (const idx of checkIndices) {
                    if (idx < localCards.length && idx < cachedCards.length) {
                        const localId = localCards[idx]?.__id || localCards[idx]?.card_id;
                        const cachedId = cachedCards[idx]?.__id || cachedCards[idx]?.card_id;
                        if (localId && cachedId && localId === cachedId) {
                            matchCount++;
                        }
                    }
                }
                
                if (matchCount === checkIndices.length) {
                    verified = true;
                    console.log('✅ Migration verified successfully!');
                } else {
                    console.warn('⚠️ ID mismatch:', matchCount, '/', checkIndices.length, 'matched');
                }
            } else {
                console.warn('⚠️ Count mismatch:', cachedCards.length, 'vs', localCards.length);
            }
        }

        if (verified) {
            setMigrationFlag(email);
            
            // ===== METADATA (TANPA HAPUS LOCALSTORAGE) =====
            localStorage.setItem('Pharmadeck_metadata_' + email, JSON.stringify({
                email: email,
                plan: localData.user_plan || 'free',
                schema_version: localData.schema_version || CURRENT_SCHEMA_VERSION,
                lastUpdated: localData.last_updated || Date.now(),
                cloudUpdatedAt: localData.last_updated ?? null,
                cardsCount: localData.cards.length,
                isAdmin: isAdmin,
                nickname: getNickname(),
                migrated: true,
                migratedAt: Date.now()
            }));
            console.log('✅ Migration complete (localStorage kept as backup)');
        } else {
            console.warn('⚠️ Migration verification failed! Keeping localStorage data.');
        }

    } catch (error) {
        console.error('❌ Migration failed for:', email, error);
    }
}
