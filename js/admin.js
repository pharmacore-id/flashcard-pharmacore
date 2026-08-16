const generateGiftCodesCallable =
  firebase.app()
    .functions('asia-southeast2')
    .httpsCallable('generateGiftCodes');

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

    btn.disabled = true;
    btn.textContent = 'Refreshing...';
    btn.classList.add('opacity-50', 'cursor-not-allowed');

    try {
        updateSyncStatus('syncing', 'Refreshing data...');

        // =====================================================
        // SATU-SATUNYA FIRESTORE SYNC
        // =====================================================

        if (currentUser) {
            await flushSaveNow(currentUser);
        }

        // =====================================================
        // SHARED DECK TIDAK PERLU DIBACA ULANG
        // karena cache sudah tersedia
        // =====================================================

        const sharedResult = await loadSharedDecksOnce();

        const sharedCards =
            Array.isArray(sharedResult)
                ? sharedResult
                : Array.isArray(sharedResult?.cards)
                    ? sharedResult.cards
                    : [];

        // =====================================================
        // AMBIL PROGRESS TERBARU DARI INDEXEDDB
        // =====================================================

        const localRecord =
            await loadFromIndexedDB(currentUser);

        const localCards =
            localRecord &&
            Array.isArray(localRecord.cards)
                ? localRecord.cards
                : [];

        // =====================================================
        // GABUNGKAN SHARED + PROGRESS
        // =====================================================

        allCards = mergeProgress(
            sharedCards,
            localCards
        );

        userPlan =
            localRecord?.plan ||
            userPlan ||
            'free';

        // =====================================================
        // RENDER UI
        // =====================================================

        renderDecks();
        updateHome();

        if (typeof renderStats === 'function') {
            renderStats();
        }

        updateSyncStatus('', 'Data refreshed');

        console.log(
            `✅ Refresh complete (${allCards.length} cards loaded)`
        );

    } catch (error) {

        console.error(
            '❌ Refresh error:',
            error
        );

        updateSyncStatus(
            'offline',
            'Refresh failed'
        );

        alert(
            '❌ Failed to refresh data.\n\n' +
            (error?.message || 'Unknown error')
        );

    } finally {

        btn.disabled = false;
        btn.textContent = 'Refresh Now';
        btn.classList.remove(
            'opacity-50',
            'cursor-not-allowed'
        );
    }
}

async function loadGlobalDeckOrder() {

    // ============================================================
    // 1. MEMORY CACHE
    // ============================================================

    if (
        deckOrderConfig &&
        Array.isArray(deckOrderConfig.topics) &&
        deckOrderConfig.topics.length > 0
    ) {
        console.log(
            '⚡ Global deck order loaded from memory'
        );

        return true;
    }


    // ============================================================
    // 2. INDEXEDDB CACHE
    // ============================================================

    try {

        const cached =
            await loadGlobalDeckOrderCache();

        if (
            cached &&
            typeof cached === 'object'
        ) {

            deckOrderConfig = {
                topics:
                    Array.isArray(cached.topics)
                        ? cached.topics
                        : [],

                subtopics:
                    cached.subtopics &&
                    typeof cached.subtopics === 'object'
                        ? cached.subtopics
                        : {}
            };

            console.log(
                '⚡ Global deck order loaded from IndexedDB'
            );

            return true;
        }

    } catch (error) {

        console.warn(
            '⚠️ Global deck order IndexedDB read failed:',
            error
        );

    }


    // ============================================================
    // 3. FIRESTORE FALLBACK
    // ============================================================

    try {

        console.log(
            '☁️ Global deck order cache miss → loading Firestore'
        );

        const doc =
            await db
                .collection('config')
                .doc('global')
                .get();

        if (
            doc.exists &&
            doc.data()?.deckOrderConfig
        ) {

            deckOrderConfig =
                doc.data().deckOrderConfig;

            console.log(
                '☁️ Global deck order loaded from Firestore'
            );


            // ====================================================
            // CACHE FIRESTORE RESULT LOCALLY
            // ====================================================

            const cached =
                await saveGlobalDeckOrderCache(
                    deckOrderConfig
                );

            if (cached) {

                console.log(
                    '💾 Global deck order saved to IndexedDB cache'
                );

            }

            return true;

        }


        // ========================================================
        // NO FIRESTORE CONFIG
        // ========================================================

        console.log(
            'ℹ️ No global deck order found → using default'
        );

        deckOrderConfig = {
            topics: [],
            subtopics: {}
        };

        await saveGlobalDeckOrderCache(
            deckOrderConfig
        );

        return false;


    } catch (error) {

        console.error(
            '❌ Failed to load global deck order:',
            error
        );

        deckOrderConfig = {
            topics: [],
            subtopics: {}
        };

        return false;
    }
}
// ===== SAVE GLOBAL =====
async function saveGlobalDeckOrder() {

    // Hanya admin
    if (!isAdmin) {
        console.warn(
            "⛔ Only admins can save deck order."
        );
        return;
    }

    try {

        // ========================================================
        // FIRESTORE
        // ========================================================

        await db
            .collection("config")
            .doc("global")
            .set({
                deckOrderConfig: deckOrderConfig,
                last_updated: Date.now(),
                updated_by: currentUser
            }, {
                merge: true
            });


        // ========================================================
        // INDEXEDDB CACHE
        // ========================================================

        await saveGlobalDeckOrderCache(
            deckOrderConfig
        );


        console.log(
            "✅ Global deck order saved + cached"
        );

    } catch (err) {

        console.error(
            "❌ Failed to save global deck order:",
            err
        );
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

async function generateGiftCodesUI(count) {

    try {

        const result =
            await generateGiftCodesCallable({
                count: count
            });

        if (!result.data?.success) {
            throw new Error(
                result.data?.message ||
                "Failed to generate gift codes"
            );
        }

        const codes =
            result.data.codes || [];

        // Tampilkan kode ke admin
        const list =
            document.getElementById("gift-code-admin-list");

        if (list) {

            list.innerHTML = codes
                .map(code => `
                    <div class="flex items-center justify-between p-2 rounded-lg"
                         style="background:var(--bg);border:1px solid var(--border);">
                        <span class="font-mono font-semibold">
                            ${code}
                        </span>
                        <span class="text-xs text-sec">
                            1 month
                        </span>
                    </div>
                `)
                .join("");
        }

        alert(
            `Successfully generated ${codes.length} gift codes.`
        );

    } catch (error) {

        console.error(
            "Generate gift codes error:",
            error
        );

        alert(
            "❌ " +
            (
                error.message ||
                "Failed to generate gift codes"
            )
        );
    }
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

async function generateGiftCodesUI(count) {

    if (!isAdmin) {
        alert('Only admins can generate gift codes.');
        return;
    }

    try {

        // ============================================
        // CONNECT TO FIREBASE CLOUD FUNCTION
        // ============================================

        if (
            typeof firebase === 'undefined' ||
            typeof firebase.functions !== 'function'
        ) {
            throw new Error(
                'Firebase Functions SDK is not loaded.'
            );
        }

        const functionsInstance =
            firebase
                .app()
                .functions('asia-southeast2');

        const generateGiftCodesCallable =
            functionsInstance.httpsCallable(
                'generateGiftCodes'
            );

        // ============================================
        // CALL BACKEND
        // ============================================

        const result =
            await generateGiftCodesCallable({
                count: count
            });

        if (!result.data?.success) {
            throw new Error(
                result.data?.message ||
                'Failed to generate gift codes'
            );
        }

        const codes =
            result.data.codes || [];

        // ============================================
        // DISPLAY GENERATED CODES
        // ============================================

        const list =
            document.getElementById(
                'gift-code-admin-list'
            );

        if (list) {

            list.innerHTML = codes
                .map(code => `
                    <div
                        class="flex items-center justify-between p-2 rounded-lg"
                        style="
                            background:var(--bg);
                            border:1px solid var(--border);
                        "
                    >
                        <span class="font-mono font-semibold">
                            ${code}
                        </span>

                        <span class="text-xs text-sec">
                            1 month
                        </span>
                    </div>
                `)
                .join("");
        }

        alert(
            `✅ Successfully generated ${codes.length} gift codes.`
        );

    } catch (error) {

        console.error(
            '❌ Generate gift codes error:',
            error
        );

        alert(
            '❌ ' +
            (
                error.message ||
                'Failed to generate gift codes'
            )
        );
    }
}

async function renderGiftCodeList() {

    if (!isAdmin) return;

    const container =
        document.getElementById(
            'gift-code-admin-list'
        );

    if (!container) return;

    try {

        const snapshot =
            await db
                .collection('giftCodes')
                .orderBy('createdAt', 'desc')
                .limit(100)
                .get();

        if (snapshot.empty) {

            container.innerHTML =
                '<p class="text-xs text-sec">No gift codes generated yet.</p>';

            return;
        }

        let html = '';

        snapshot.forEach(doc => {

            const c = doc.data();

            const used =
                c.used === true;

            html += `
                <div
                    class="flex items-center justify-between gap-3 p-2 rounded-lg"
                    style="
                        background:var(--bg);
                        border:1px solid var(--border);
                    "
                >

                    <span class="font-mono font-semibold">
                        ${c.code}
                    </span>

                    <span class="text-xs ${
                        used
                            ? 'text-gray-400'
                            : 'text-green-600'
                    }">
                        ${
                            used
                                ? 'USED'
                                : 'AVAILABLE'
                        }
                    </span>

                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {

        console.error(
            'Failed to load gift codes:',
            error
        );

        container.innerHTML =
            '<p class="text-xs text-red-500">Failed to load gift codes.</p>';
    }
}
