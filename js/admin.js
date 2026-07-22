function switchTab(tab) {
  if (currentTab === tab && tab !== 'study-select') return;

  currentTab = tab;

  const allViews = ['home', 'decks', 'study-select', 'flashcards', 'learn', 'test', 'stats', 'settings', 'admin-import', 'admin-cards', 'faq'];

  allViews.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) {
      el.classList.remove('active');
      el.style.display = 'none';
    }
  });

  const targetView = document.getElementById('view-' + tab);
  if (targetView) {
    targetView.classList.add('active');
    targetView.style.display = 'flex';
  }

  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });

  if (tab === 'stats') renderStats();
  if (tab === 'home') updateHome();
  if (tab === 'decks') {
    currentTopic = null;
    renderDecks();
  }

  // Render ikon untuk FAQ
  if (tab === 'faq') {
    setTimeout(() => {
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    }, 150);
  }

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

 async function renderRequestList() {
  const container = document.getElementById('request-list');
  if (!container) return;

  try {
    const snapshot = await db.collection('deckRequests')
      .orderBy('date', 'desc')
      .limit(50)
      .get();

    if (snapshot.empty) {
      container.innerHTML = '<p class="text-xs text-sec">No requests yet.</p>';
      return;
    }

    container.innerHTML = '';
    snapshot.forEach(doc => {
      const req = doc.data();
      const date = req.date?.toDate?.() || new Date(req.date);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const div = document.createElement('div');
      div.className = 'p-3 bg-gray-50 dark:bg-gray-800 rounded-xl';
      div.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <p class="text-sm font-medium">${req.topic}${req.subtopic ? ' - ' + req.subtopic : ''}</p>
            <p class="text-xs text-sec mt-0.5">${req.notes || 'No notes'}</p>
            <p class="text-xs text-sec mt-1">From: ${req.user} · ${dateStr}</p>
          </div>
          <div class="flex gap-2">
            <button onclick="markRequestDone('${doc.id}')" 
                    class="text-xs bg-green-500 text-white px-2 py-1 rounded-lg hover:bg-green-600">
              Done
            </button>
            <button onclick="deleteRequest('${doc.id}')" 
                    class="text-xs bg-red-500 text-white px-2 py-1 rounded-lg hover:bg-red-600">
              Delete
            </button>
          </div>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (error) {
    console.error('Failed to load requests:', error);
    container.innerHTML = '<p class="text-xs text-red-500">Failed to load requests.</p>';
  }
}

async function markRequestDone(requestId) {
  try {
    await db.collection('deckRequests').doc(requestId).update({ status: 'done' });
    renderRequestList();
  } catch (error) {
    console.error('Failed to update request:', error);
  }
}

async function deleteRequest(requestId) {
  if (!confirm('Delete this request?')) return;
  try {
    await db.collection('deckRequests').doc(requestId).delete();
    renderRequestList();
  } catch (error) {
    console.error('Failed to delete request:', error);
  }
}
    
    async function toggleDeckPremium(deckId) {
  if (!isAdmin) return;

  const deckCards = allCards.filter(c => c.deck_id === deckId && c.isShared);
  if (deckCards.length === 0) return;

  const isCurrentlyPremium = deckCards.some(c => c.isPremium);
  const newPremiumStatus = !isCurrentlyPremium;

  allCards.forEach(c => {
    if (c.deck_id === deckId && c.isShared) {
      c.isPremium = newPremiumStatus;
    }
  });

  const docId = deckId.replace('shared_', '');
  try {
    await db.collection('sharedDecks').doc(docId).update({
      isPremium: newPremiumStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await saveUserData(currentUser);
    renderDecks();
    updateHome();
    renderAdminDeckList();

    alert(`✅ Deck status changed to ${newPremiumStatus ? 'PREMIUM' : 'FREE'}!`);
  } catch (error) {
    console.error('❌ Failed to update deck status:', error);
    alert('❌ Failed to update deck status.');
  }
}
    
    function showAdminImport() {
      if (!isAdmin) {
        alert('Only admins can import decks.');
        return;
      }
      document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
        v.style.display = 'none';
      });
      const adminImportView = document.getElementById('view-admin-import');
      if (adminImportView) {
        adminImportView.classList.add('active');
        adminImportView.style.display = 'flex';
      }
      currentTab = 'admin-import';
      renderAdminDeckList();
      renderCodeList();
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    }

function renderAdminDeckList() {
  const container = document.getElementById('admin-deck-list');
  if (!container) return;

  const decks = getDecks();
  if (decks.length === 0) {
    container.innerHTML = '<p class="text-xs text-sec">No decks yet.</p>';
    return;
  }

  selectedDeckIds = [];

  let html = `
    <div class="flex items-center gap-3 mb-3">
      <input type="checkbox" id="select-all-decks" onchange="toggleAllDecks()" />
      <label for="select-all-decks" class="text-xs font-medium">Select All</label>
      <button onclick="deleteSelectedDecks()" id="delete-selected-decks-btn" 
              class="bg-red-500 text-white text-xs px-3 py-1 rounded-lg hover:bg-red-600 transition-colors" disabled>
        Delete Selected
      </button>
      <span class="text-xs text-sec ml-auto" id="selected-decks-count">0 selected</span>
    </div>
  `;

  decks.forEach(d => {
    const isDeckPremium = d.cards.some(c => c.isPremium);
    const premiumBadge = isDeckPremium ? '⭐ PREMIUM' : 'Free';
    const premiumColor = isDeckPremium ? 'text-yellow-500' : 'text-sec';

    html += `
      <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl mb-2">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <input type="checkbox" class="deck-checkbox" data-deck-id="${d.id}" 
                 onchange="toggleDeckSelection('${d.id}', this)" />
          <div class="flex-1 min-w-0">
            <span class="text-sm font-medium truncate block">${d.name} (${d.cards.length} cards)</span>
            <span class="text-xs ${premiumColor} font-medium">${premiumBadge}</span>
          </div>
        </div>
        <div class="flex gap-2 flex-shrink-0">
          <button onclick="toggleDeckPremium('${d.id}')" 
                  class="px-2 py-1 rounded-lg text-xs font-bold text-white transition-colors
                         ${isDeckPremium ? 'bg-gray-400 hover:bg-gray-500' : 'bg-yellow-500 hover:bg-yellow-600'}">
            ${isDeckPremium ? 'Set Free' : 'Set Premium'}
          </button>
          <button onclick="deleteDeck('${d.id}')" class="text-red-500 hover:text-red-700 text-xs">🗑️</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function toggleDeckSelection(deckId, checkbox) {
  if (checkbox.checked) {
    if (!selectedDeckIds.includes(deckId)) selectedDeckIds.push(deckId);
  } else {
    selectedDeckIds = selectedDeckIds.filter(id => id !== deckId);
  }
  updateDeckSelectionUI();
}

function toggleAllDecks() {
  const selectAll = document.getElementById('select-all-decks');
  const checkboxes = document.querySelectorAll('.deck-checkbox');

  checkboxes.forEach(cb => {
    cb.checked = selectAll.checked;
    const deckId = cb.dataset.deckId;
    if (selectAll.checked) {
      if (!selectedDeckIds.includes(deckId)) selectedDeckIds.push(deckId);
    } else {
      selectedDeckIds = selectedDeckIds.filter(id => id !== deckId);
    }
  });
  updateDeckSelectionUI();
}

function updateDeckSelectionUI() {
  const count = selectedDeckIds.length;
  document.getElementById('selected-decks-count').textContent = count + ' selected';
  document.getElementById('delete-selected-decks-btn').disabled = count === 0;

  const totalCheckboxes = document.querySelectorAll('.deck-checkbox').length;
  const checkedCheckboxes = document.querySelectorAll('.deck-checkbox:checked').length;
  document.getElementById('select-all-decks').checked = totalCheckboxes > 0 && checkedCheckboxes === totalCheckboxes;
}

async function deleteSelectedDecks() {
  if (selectedDeckIds.length === 0) {
    alert('No decks selected.');
    return;
  }

  if (!confirm(`Delete ${selectedDeckIds.length} selected deck(s)?`)) return;

  for (const deckId of selectedDeckIds) {
    const isSharedDeck = allCards.some(c => c.deck_id === deckId && c.isShared);
    if (isSharedDeck) {
      const docId = deckId.replace('shared_', '');
      try {
        await db.collection('sharedDecks').doc(docId).delete();
      } catch (error) {
        console.error('Failed to delete shared deck:', error);
      }
    }
    // ===== HAPUS DARI allCards =====
    allCards = allCards.filter(c => c.deck_id !== deckId);
  }

  await saveUserData(currentUser);
  selectedDeckIds = [];
  renderDecks();
  updateHome();
  renderAdminDeckList();

  document.getElementById('select-all-decks').checked = false;
  document.getElementById('delete-selected-decks-btn').disabled = true;
  document.getElementById('selected-decks-count').textContent = '0 selected';

  alert(`✅ ${deletedCount} deck(s) deleted successfully!`);
}

async function refreshUserData() {
    const btn = document.getElementById('refresh-btn');
    if (!btn) return;

    // ===== DISABLE TOMBOL =====
    btn.disabled = true;
    btn.textContent = 'Refreshing...';
    btn.classList.add('opacity-50', 'cursor-not-allowed');

    try {
        updateSyncStatus('syncing', 'Refreshing data...');

        // ===================================================
        //  STEP 1: FLUSH SAVE DULU (PASTIKAN DATA LOCAL TERSIMPAN)
        // ===================================================
        if (currentUser) {
            if (saveTimeout) {
                clearTimeout(saveTimeout);
                saveTimeout = null;
            }
            await flushSaveNow(currentUser);
        }

        // ===================================================
        //  STEP 2: LOAD ULANG DARI FIRESTORE
        // ===================================================
        const cloudData = await loadFromFirebase(currentUser);

        if (cloudData && cloudData.cards) {
            // ===== SET DATA =====
            allCards = cloudData.cards;
            userPlan = cloudData.plan || 'free';

            // ============================================================
            //  STEP 3: SAVE KE INDEXEDDB (TANPA markProgressUpdated!)
            //  Ini hanya sync dari cloud, BUKAN perubahan progress user
            // ============================================================
            await saveToIndexedDB(currentUser, {
                cards: cloudData.cards,
                plan: cloudData.plan || 'free',
                schema_version: cloudData.schema_version || CURRENT_SCHEMA_VERSION,
                cloudUpdatedAt: cloudData.last_updated ?? null
                // TIDAK ADA markProgressUpdated!
            });
            console.log('📦 IndexedDB updated from cloud');

            // ============================================================
            //  STEP 4: METADATA KECIL DI LOCALSTORAGE
            // ============================================================
            try {
                localStorage.setItem('Pharmadeck_metadata_' + currentUser, JSON.stringify({
                    plan: userPlan,
                    cardsCount: allCards.length,
                    source: 'refresh',
                    lastUpdated: Date.now()
                }));
            } catch (e) {
                console.warn('⚠️ Metadata save failed:', e);
            }

            // ===== RENDER ULANG UI =====
            renderDecks();
            updateHome();
            if (typeof renderStats === 'function') renderStats();

            updateSyncStatus('', 'Data refreshed');
            console.log(`✅ Refresh complete (${allCards.length} cards loaded)`);
            return;
        }

        // ============================================================
        //  STEP 5: FALLBACK - RELOAD SHARED DECKS
        //  (Jika cloudData tidak ditemukan)
        // ============================================================
        console.warn('⚠️ Cloud data not found, reloading shared decks...');

        // ===== SIMPAN PROGRESS LAMA =====
        const progressMap = new Map();
        allCards.forEach(card => {
            if (card.isShared) {
                const key = card.__id || card.card_id;
                progressMap.set(key, {
                    ease_factor: card.ease_factor,
                    interval: card.interval,
                    repetitions: card.repetitions,
                    total_reviews: card.total_reviews,
                    correct_count: card.correct_count,
                    next_review: card.next_review,
                    last_review: card.last_review,
                    review_history: card.review_history || []
                });
            }
        });

        // ===== LOAD SHARED DECKS BARU =====
        const sharedCards = await loadSharedDecksOnce();

        // ===== MERGE PROGRESS =====
        const mergedSharedCards = sharedCards.map(card => {
            const key = card.__id || card.card_id;
            const progress = progressMap.get(key);
            return progress ? { ...card, ...progress } : card;
        });

        // ===== PERTAHANKAN CUSTOM CARDS =====
        const customCards = allCards.filter(c => !c.isShared);

        // ===== GABUNGKAN =====
        allCards = [...customCards, ...mergedSharedCards];

        // ============================================================
        //  SAVE KE INDEXEDDB (TANPA markProgressUpdated)
        // ============================================================
        await saveToIndexedDB(currentUser, {
            cards: buildProgressData(),
            plan: userPlan,
            schema_version: CURRENT_SCHEMA_VERSION,
            cloudUpdatedAt: null
            // TIDAK ADA markProgressUpdated!
        });
        console.log('📦 IndexedDB updated (fallback)');

        // ===== METADATA =====
        try {
            localStorage.setItem('Pharmadeck_metadata_' + currentUser, JSON.stringify({
                plan: userPlan,
                cardsCount: allCards.length,
                source: 'refresh_fallback',
                lastUpdated: Date.now()
            }));
        } catch (e) {
            console.warn('⚠️ Metadata save failed:', e);
        }

        renderDecks();
        updateHome();
        if (typeof renderStats === 'function') renderStats();

        updateSyncStatus('', 'Shared decks refreshed');
        console.log(`✅ Shared decks refreshed (${allCards.length} cards loaded)`);

    } catch (error) {
        console.error('❌ Refresh error:', error);
        updateSyncStatus('offline', 'Refresh failed');
        alert('❌ Failed to refresh data.\n\n' + (error?.message || 'Unknown error'));
    } finally {
        // ===== ENABLE KEMBALI TOMBOL =====
        btn.disabled = false;
        btn.textContent = 'Refresh Now';
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

async function loadGlobalDeckOrder() {
    try {
        const doc = await db.collection("config").doc("global").get();
        if (doc.exists && doc.data().deckOrderConfig) {
            deckOrderConfig = doc.data().deckOrderConfig;
            console.log("✅ Loaded global deck order from Firestore");
            return true;
        } else {
            console.log("ℹ️ No global deck order found, using default");
            // Initialize with empty object
            deckOrderConfig = { topics: [], subtopics: {} };
            return false;
        }
    } catch (err) {
        console.error("❌ Failed to load global deck order:", err);
        deckOrderConfig = { topics: [], subtopics: {} };
        return false;
    }
}

// ===== SAVE GLOBAL =====
async function saveGlobalDeckOrder() {
    // Hanya admin yang bisa save
    if (!isAdmin) {
        console.warn("⛔ Only admins can save deck order.");
        return;
    }
    
    try {
        await db.collection("config").doc("global").set({
            deckOrderConfig: deckOrderConfig,
            last_updated: Date.now(),
            updated_by: currentUser
        }, { merge: true });
        console.log("✅ Global deck order saved");
    } catch (err) {
        console.error("❌ Failed to save global deck order:", err);
    }
}

// ===== INITIALIZE DECK ORDER (SAFE VERSION) =====
function initializeDeckOrder() {
    console.log('🔄 Initializing deck order...');
    
    if (!deckOrderConfig) deckOrderConfig = {};
    if (!deckOrderConfig.topics) deckOrderConfig.topics = [];
    if (!deckOrderConfig.subtopics) deckOrderConfig.subtopics = {};
    
    const decks = getDecks();
    const topics = [...new Set(decks.map(d => d.topic))];
    let changed = false;
  
    const filteredTopics = deckOrderConfig.topics.filter(t => topics.includes(t));
    if (filteredTopics.length !== deckOrderConfig.topics.length) {
        deckOrderConfig.topics = filteredTopics;
        changed = true;
        console.log('🗑️ Removed deleted topics');
    }
    topics.forEach(topic => {
        if (!deckOrderConfig.topics.includes(topic)) {
            deckOrderConfig.topics.push(topic);
            changed = true;
            console.log(`➕ Added new topic: ${topic}`);
        }
    });
    
    topics.forEach(topic => {
        const subs = decks
            .filter(d => d.topic === topic)
            .map(d => d.subtopic);
        
        if (!deckOrderConfig.subtopics[topic]) {
            deckOrderConfig.subtopics[topic] = [];
        }
        
        // Hapus subtopic yang sudah tidak ada
        const filteredSubs = deckOrderConfig.subtopics[topic].filter(s => subs.includes(s));
        if (filteredSubs.length !== deckOrderConfig.subtopics[topic].length) {
            deckOrderConfig.subtopics[topic] = filteredSubs;
            changed = true;
            console.log(`🗑️ Removed deleted subtopics from: ${topic}`);
        }
        
        // Tambahkan subtopic baru
        subs.forEach(sub => {
            if (!deckOrderConfig.subtopics[topic].includes(sub)) {
                deckOrderConfig.subtopics[topic].push(sub);
                changed = true;
                console.log(`➕ Added new subtopic: ${sub} (${topic})`);
            }
        });
    });
    
    // Auto-save jika ada perubahan dan user adalah admin
    if (changed && isAdmin) {
        console.log('💾 Auto-saving global deck order...');
        saveGlobalDeckOrder();
    }
    
    console.log('✅ Deck order initialized:', deckOrderConfig);
}
    
   async function renderCodeList() {
  const container = document.getElementById('code-list');
  if (!container) return;

  try {
    const snapshot = await db.collection('accessCodes')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    if (snapshot.empty) {
      container.innerHTML = '<p class="text-xs text-sec">No codes generated yet.</p>';
      return;
    }

    container.innerHTML = '';
    snapshot.forEach(doc => {
      const c = doc.data();
      const div = document.createElement('div');
      div.className = 'flex items-center justify-between text-xs p-1 bg-gray-50 dark:bg-gray-800 rounded';
      div.innerHTML = `
        <span class="font-mono">${c.code}</span>
        <div class="flex items-center gap-2">
          <span class="${c.used ? 'text-red-500' : 'text-green-500'}">${c.used ? 'Used' : 'Available'}</span>
          <button onclick="deleteCode('${c.code}')" class="text-red-400 hover:text-red-600" title="Delete code">🗑️</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (error) {
    console.error('Failed to load codes:', error);
    container.innerHTML = '<p class="text-xs text-red-500">Failed to load codes.</p>';
  }
}

 async function deleteCode(code) {
  if (!isAdmin) return;
  if (!confirm(`Delete code "${code}"?`)) return;
  
  try {
    await db.collection('accessCodes').doc(code).delete();
    alert(`✅ Code "${code}" deleted!`);
    renderCodeList();
  } catch (error) {
    console.error('Failed to delete code:', error);
    alert('❌ Failed to delete code.');
  }
}

// ===== FUNGSI REORDER TOPIC =====
async function moveTopicUp(topic) {
    const idx = deckOrderConfig.topics.indexOf(topic);
    if (idx <= 0) return;

    // Swap
    [deckOrderConfig.topics[idx - 1], deckOrderConfig.topics[idx]] =
    [deckOrderConfig.topics[idx], deckOrderConfig.topics[idx - 1]];

    // ===== SIMPAN KE GLOBAL =====
    await saveGlobalDeckOrder();

    renderDecks();
}

async function moveTopicDown(topic) {
    const idx = deckOrderConfig.topics.indexOf(topic);
    if (idx === -1 || idx >= deckOrderConfig.topics.length - 1) return;

    // Swap
    [deckOrderConfig.topics[idx + 1], deckOrderConfig.topics[idx]] =
    [deckOrderConfig.topics[idx], deckOrderConfig.topics[idx + 1]];

    // ===== SIMPAN KE GLOBAL =====
    await saveGlobalDeckOrder();

    renderDecks();
}

// ===== FUNGSI REORDER SUBTOPIC =====
async function moveSubtopicUp(topic, subtopic) {
    const order = deckOrderConfig.subtopics[topic];
    const idx = order.indexOf(subtopic);
    if (idx <= 0) return;

    [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];

    await saveGlobalDeckOrder();
    renderDecks();
}

async function moveSubtopicDown(topic, subtopic) {
    const order = deckOrderConfig.subtopics[topic];
    const idx = order.indexOf(subtopic);
    if (idx === -1 || idx >= order.length - 1) return;

    [order[idx + 1], order[idx]] = [order[idx], order[idx + 1]];

    await saveGlobalDeckOrder();
    renderDecks();
}
