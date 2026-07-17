function getRealCards() {
      return allCards.filter(c => c.card_front && c.card_front !== '__deck_placeholder__' && c.card_front.trim() !== '');
    }

    function getDecks() {
      const map = {};
      allCards.forEach(c => {
        if (!c.deck_id) return;
        if (!map[c.deck_id]) {
          map[c.deck_id] = {
            id: c.deck_id,
            name: c.deck_name || 'Untitled',
            cards: [],
            topic: c.topic || 'General',
            subtopic: c.subtopic || ''
          };
        }
        if (c.card_front !== '__deck_placeholder__' && c.card_front && c.card_front.trim() !== '') {
          map[c.deck_id].cards.push(c);
        }
      });
      return Object.values(map);
    }

 function isCurrentDeckPremium() {
  if (!currentDeckId) return false;
  return allCards.some(c => c.deck_id === currentDeckId && c.isPremium);
}
    function getDueCards(deckId) {
      const now = today();
      let cards = getRealCards();
      if (deckId) cards = cards.filter(c => c.deck_id === deckId);
      return cards.filter(c => !c.next_review || c.next_review <= now);
    }

 function renderDecks() {
    console.time('⏱️ renderDecks');
    
    try {
        const container = document.getElementById('deck-list');
        const no = document.getElementById('no-decks');

        if (!container) return;

  const decks = getDecks();

  const topicMap = {};

  decks.forEach(d => {
    const topic = d.topic || 'General';

    if (!topicMap[topic]) {
      topicMap[topic] = [];
    }

    topicMap[topic].push(d);
  });
     
  const sortedTopics =
  Object.keys(topicMap)
  .sort((a,b)=>{

    const idxA =
      deckOrderConfig.topics.indexOf(a);

    const idxB =
      deckOrderConfig.topics.indexOf(b);

    if(idxA === -1 && idxB === -1)
      return a.localeCompare(b);

    if(idxA === -1) return 1;

    if(idxB === -1) return -1;

    return idxA - idxB;

  });

  if (decks.length === 0) {
    container.innerHTML = '';

    if (no) {
      no.classList.remove('hidden');
    }

    return;
  }

  if (no) {
    no.classList.add('hidden');
  }

  // ===== LEVEL 2: SUBTOPICS =====
  if (currentTopic) {

    const subtopics =
  (topicMap[currentTopic] || [])
  .sort((a,b)=>{

    const order =
      deckOrderConfig.subtopics[currentTopic]
      || [];

    const idxA =
      order.indexOf(a.subtopic);

    const idxB =
      order.indexOf(b.subtopic);

    if(idxA === -1 && idxB === -1)
      return a.subtopic.localeCompare(
        b.subtopic
      );

    if(idxA === -1) return 1;

    if(idxB === -1) return -1;

    return idxA - idxB;

  });

    let html = `
    <div class="mb-4">
      <button
        onclick="currentTopic=null;renderDecks()"
        class="flex items-center gap-2 text-sec hover:text-accent">

        <i data-lucide="arrow-left"
           class="w-5 h-5"></i>

        <span class="font-medium">
          Back to Topics
        </span>

      </button>

      <h2 class="text-xl font-bold mt-2">
        ${currentTopic}
      </h2>

    </div>
    `;

    subtopics.forEach((d,i)=>{

      const due =
        d.cards.filter(
          c=>!c.next_review ||
          c.next_review<=today()
        ).length;

      const mastered =
        d.cards.filter(
          c=>(c.interval||0)>=21
        ).length;

      const pct =
        d.cards.length>0
        ? Math.round(
            mastered/
            d.cards.length*100
          )
        :0;

      const bgCard =
        d.cards.find(
          c=>c.card_background &&
          c.card_background.trim()!==''
        );

      const background =
        bgCard
        ? bgCard.card_background
        : '';

      let bgStyle='';
      let iconHtml='';

      if(background){

        if(background.startsWith('http')){

          bgStyle=
          `background:
          linear-gradient(
          rgba(0,0,0,.4),
          rgba(0,0,0,.4)),
          url('${background}')
          center/cover no-repeat;
          color:white;`;

        } else {

          iconHtml=
          `<span class="text-3xl mr-2">
            ${background}
          </span>`;
        }

      } else {

        const colors=[
          'var(--card-peach)',
          'var(--card-green)',
          'var(--card-blue)',
          'var(--card-purple)'
        ];

        bgStyle=
        `background:${colors[i%4]};
        color:white;`;
      }

      const isPremiumDeck =
        d.cards.some(
          c=>c.isPremium
        );

      html += `
      <div class="deck-item
                  rounded-2xl
                  p-4
                  shadow-card
                  mb-3
                  cursor-pointer
                  flex
                  items-center
                  relative
                  text-white"

          style="${bgStyle}
                 height:120px;"

          onclick="openDeck('${d.id}')">

        <div class="flex-1"
             style="max-width:66.666%;">

          ${iconHtml
            ? `<div class="mb-1">
                ${iconHtml}
              </div>`
            : ''}

          <div class="flex justify-between items-start">

  <h3 class="font-bold uppercase text-white"
      style="
        font-size:16px;
        line-height:1.2;
        word-break:break-word;">

    ${d.subtopic || d.name}

  </h3>

  ${isAdmin ? `
    <div class="flex gap-1 ml-2">

      <button
        class="bg-black/30 rounded px-2 py-1 text-xs"
        onclick="
          event.stopPropagation();
          moveSubtopicUp(
            '${currentTopic.replace(/'/g, "\\'")}',
            '${(d.subtopic || '').replace(/'/g, "\\'")}'
          );
        ">
        ⬆️
      </button>

      <button
        class="bg-black/30 rounded px-2 py-1 text-xs"
        onclick="
          event.stopPropagation();
          moveSubtopicDown(
            '${currentTopic.replace(/'/g, "\\'")}',
            '${(d.subtopic || '').replace(/'/g, "\\'")}'
          );
        ">
        ⬇️
      </button>

    </div>
  ` : ''}

</div>

<p class="text-white"
   style="
   font-size:11px;
   margin-top:4px;">

  ${d.cards.length}
  cards ·
  ${due}
  due ·
  ${pct}% mastered

</p>
          <div class="progress-bar bg-white/30"
               style="height:4px">

            <div class="progress-fill bg-white"
                 style="
                 width:${pct}%;
                 height:4px;">
            </div>

          </div>

        </div>

        ${
          isPremiumDeck
          ? `
          <div class="
            absolute
            top-2
            right-2
            bg-gradient-to-r
            from-yellow-500
            to-amber-500
            text-white
            text-[10px]
            font-bold
            px-2
            py-0.5
            rounded-full">

            PREMIUM

          </div>`
          : ''
        }

      </div>
      `;

    });

    container.innerHTML = html;

    if(
      typeof lucide!=='undefined'
      && lucide.createIcons
    ){
      lucide.createIcons();
    }

    return;
  }


  let html = '';
  sortedTopics.forEach((topic) => {
    const subtopics = topicMap[topic];
    const totalCards = subtopics.reduce((sum, d) => sum + d.cards.length, 0);

    let bgStyle = '';
    let iconHtml = '';
    for (const d of subtopics) {
      const bgCard = d.cards.find(c => c.card_background && c.card_background.trim() !== '');
      if (bgCard) {
        const background = bgCard.card_background;
        if (background.startsWith('http')) {
          bgStyle = `background: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('${background}') center/cover no-repeat; color: white;`;
        } else {
          iconHtml = `<span class="text-4xl mr-3">${background}</span>`;
        }
        break;
      }
    }
    if (!bgStyle) {
      bgStyle = 'color: white; background: var(--surface);';
    }

    html += `
      <div class="topic-card surface rounded-2xl p-5 border border-theme shadow-card mb-4 cursor-pointer hover:shadow-lg transition-shadow flex items-center text-white"
           style="height: 150px; ${bgStyle}"
           onclick="currentTopic='${topic.replace(/'/g, "\\'")}'; renderDecks();">
        <div class="flex items-center gap-4 w-full">
          ${iconHtml}
          <div class="flex-1">
            <h3 class="font-bold text-lg uppercase text-white" style="white-space: normal; word-break: break-word;">${topic}</h3>
            ${isAdmin ? `
<div class="flex gap-1">
<button
onclick="
event.stopPropagation();
moveTopicUp('${topic}');
">
⬆️
</button>

<button
onclick="
event.stopPropagation();
moveTopicDown('${topic}');
">
⬇️
</button>
</div>
` : ''}
            <p class="text-sm text-white/80 mt-2">${subtopics.length} subtopics · ${totalCards} cards</p>
          </div>
        </div>
      </div>
    `;
  });
     container.innerHTML = html;
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
        
    } finally {
        console.timeEnd('⏱️ renderDecks');
    }
}

function showRenameDeck(deckId) {
      if (!isAdmin) return;
      renameDeckId = deckId;
      const deck = allCards.find(c => c.deck_id === deckId && c.card_front === '__deck_placeholder__');
      document.getElementById('rename-deck-input').value = deck ? deck.deck_name : '';
      document.getElementById('rename-deck-modal').classList.remove('hidden');
      setTimeout(() => document.getElementById('rename-deck-input').focus(), 100);
    }

    function closeRenameDeck() {
      document.getElementById('rename-deck-modal').classList.add('hidden');
    }

    function saveRenameDeck() {
      const newName = document.getElementById('rename-deck-input').value.trim();
      if (!newName || !renameDeckId) return;

      allCards.forEach(c => {
        if (c.deck_id === renameDeckId) {
          c.deck_name = newName;
        }
      });

     saveUserData(currentUser)
  .catch(console.error);
      closeRenameDeck();
      renderDecks();
      updateHome();
      alert('✅ Deck renamed successfully!');
    }

 function openDeck(deckId){

    if(!deckId) return;

    currentDeckId = deckId;

    openStudySelect();
}

 function openStudySelect() {
      const deck = allCards.find(c => c.deck_id === currentDeckId && c.card_front === '__deck_placeholder__');
      const deckName = deck ? deck.deck_name : 'Deck';
      const nameEl = document.getElementById('study-deck-name');
      if (nameEl) nameEl.textContent = deckName;

      document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
        v.style.display = 'none';
      });

      const studySelectView = document.getElementById('view-study-select');
      if (studySelectView) {
        studySelectView.classList.add('active');
        studySelectView.style.display = 'flex';
      }

      document.querySelectorAll('.nav-item').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === 'decks');
      });

      const isPremium = isPremiumActive();
      const learnBtn = document.getElementById('learn-mode-btn');
      const testBtn = document.getElementById('test-mode-btn');
      const lockMsg = document.getElementById('premium-lock-msg');

      if (!isPremium) {
        if (learnBtn) learnBtn.style.opacity = '0.5';
        if (testBtn) testBtn.style.opacity = '0.5';
        if (lockMsg) lockMsg.classList.remove('hidden');
      } else {
        if (learnBtn) learnBtn.style.opacity = '1';
        if (testBtn) testBtn.style.opacity = '1';
        if (lockMsg) lockMsg.classList.add('hidden');
      }

      const userIsPremium = isPremiumActive();
const deckIsPremium = isCurrentDeckPremium();

// Jika user free & deck premium → kunci semua mode
if (!userIsPremium && deckIsPremium) {
  const flashcardsBtn = document.querySelector('.mode-btn .icon-wrap.orange')?.parentElement;
  const learnBtn = document.getElementById('learn-mode-btn');
  const testBtn = document.getElementById('test-mode-btn');
  const lockMsg = document.getElementById('premium-lock-msg');

  if (flashcardsBtn) { flashcardsBtn.style.opacity = '0.5'; flashcardsBtn.style.pointerEvents = 'none'; }
  if (learnBtn) { learnBtn.style.opacity = '0.5'; learnBtn.style.pointerEvents = 'none'; }
  if (testBtn) { testBtn.style.opacity = '0.5'; testBtn.style.pointerEvents = 'none'; }
  if (lockMsg) {
    lockMsg.classList.remove('hidden');
    lockMsg.innerHTML = `<p class="text-sm font-medium text-orange-600 dark:text-orange-400">🔒 Premium Deck</p>
                         <p class="text-xs text-sec mt-1">This deck is exclusive to Premium users. Upgrade to study it.</p>
                         <button onclick="showUpgradeModal()" class="mt-2 text-sm accent-bg text-white px-4 py-1.5 rounded-xl font-medium">Upgrade Now</button>`;
  }
} else {
  // Kembalikan ke perilaku normal (free user dengan deck biasa)
  const flashcardsBtn = document.querySelector('.mode-btn .icon-wrap.orange')?.parentElement;
  const learnBtn = document.getElementById('learn-mode-btn');
  const testBtn = document.getElementById('test-mode-btn');
  const lockMsg = document.getElementById('premium-lock-msg');

  if (!userIsPremium) {
    // Free user, deck biasa: Flashcards bisa, Learn/Test terkunci
    if (flashcardsBtn) { flashcardsBtn.style.opacity = '1'; flashcardsBtn.style.pointerEvents = 'auto'; }
    if (learnBtn) { learnBtn.style.opacity = '0.5'; learnBtn.style.pointerEvents = 'none'; }
    if (testBtn) { testBtn.style.opacity = '0.5'; testBtn.style.pointerEvents = 'none'; }
    if (lockMsg) {
      lockMsg.classList.remove('hidden');
      lockMsg.innerHTML = `<p class="text-sm font-medium text-orange-600 dark:text-orange-400">🔒 Premium feature</p>
                           <p class="text-xs text-sec mt-1">Enter your pharmacy book's access code or upgrade to unlock Learn and Test modes.</p>
                           <button onclick="showUpgradeModal()" class="mt-2 text-sm accent-bg text-white px-4 py-1.5 rounded-xl font-medium">Upgrade Now</button>`;
    }
  } else {
    // User premium: semua mode bisa
    if (flashcardsBtn) { flashcardsBtn.style.opacity = '1'; flashcardsBtn.style.pointerEvents = 'auto'; }
    if (learnBtn) { learnBtn.style.opacity = '1'; learnBtn.style.pointerEvents = 'auto'; }
    if (testBtn) { testBtn.style.opacity = '1'; testBtn.style.pointerEvents = 'auto'; }
    if (lockMsg) lockMsg.classList.add('hidden');
  }
}
      currentTab = 'study-select';

      updateDeckStats();

      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    }

 // ============================================================
    //  DECK STATS (for study select)
    // ============================================================
    function updateDeckStats() {
      const deckCards = getRealCards().filter(c => c.deck_id === currentDeckId);
      const total = deckCards.length;

      const totalReviews = deckCards.reduce((s, c) => s + (c.total_reviews || 0), 0);
      const correctReviews = deckCards.reduce((s, c) => s + (c.correct_count || 0), 0);
      const retention = totalReviews > 0 ? Math.round((correctReviews / totalReviews) * 100) : 0;
      document.getElementById('deck-retention').textContent = retention + '%';

      const mastered = deckCards.filter(c => (c.interval || 0) >= 21).length;
      const masteredPct = total > 0 ? Math.round((mastered / total) * 100) : 0;
      document.getElementById('deck-mastered').textContent = masteredPct + '%';

      const avgTime = totalReviews > 0 ? Math.round(totalReviews / total * 2) : 0;
      document.getElementById('deck-avg-time').textContent = avgTime + 's';

      document.getElementById('deck-reviews').textContent = totalReviews;

      document.getElementById('deck-trend').textContent = '📈 +0% from last week';

      const due = getDueCards(currentDeckId);
      const todayStr = today();
      const dueToday = due.filter(c => c.next_review === todayStr || !c.next_review).length;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      const dueTomorrow = due.filter(c => c.next_review === tomorrowStr).length;
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const dueWeek = due.filter(c => c.next_review && c.next_review >= todayStr && c.next_review <= nextWeek.toISOString()
        .split('T')[0]).length;

      document.getElementById('deck-due-today').textContent = dueToday;
      document.getElementById('deck-due-tomorrow').textContent = dueTomorrow;
      document.getElementById('deck-due-week').textContent = dueWeek;
      document.getElementById('deck-total-cards').textContent = total;

      const weak = deckCards.filter(c => (c.total_reviews || 0) >= 2 && (c.correct_count || 0) / (c.total_reviews || 1) < 0.5)
        .sort((a, b) => (a.correct_count / (a.total_reviews || 1)) - (b.correct_count / (b.total_reviews || 1)))
        .slice(0, 5);

      const weakContainer = document.getElementById('weak-cards-list');
      const weakCount = document.getElementById('weak-count');
      if (weakContainer) {
        if (weak.length === 0) {
          weakContainer.innerHTML = '<p class="text-xs text-sec text-center py-2">No weak cards yet! 🎉</p>';
          if (weakCount) weakCount.textContent = '0 cards';
        } else {
          weakContainer.innerHTML = weak.map(c => `
              <div class="weak-card-item">
                <span class="card-text">${c.card_front || 'Untitled'}</span>
                <span class="wrong-count">${Math.round((1 - (c.correct_count / (c.total_reviews || 1))) * 100)}% wrong</span>
              </div>
            `).join('');
          if (weakCount) weakCount.textContent = weak.length + ' cards';
        }
      }

      const weakBtn = document.getElementById('study-weak-btn');
      if (weakBtn) {
        weakBtn.style.display = weak.length > 0 ? 'block' : 'none';
      }
    }

    function studyWeakCards() {
      const weak = getRealCards().filter(c =>
        c.deck_id === currentDeckId &&
        (c.total_reviews || 0) >= 2 &&
        (c.correct_count || 0) / (c.total_reviews || 1) < 0.5
      );
      if (weak.length === 0) {
        alert('No weak cards in this deck!');
        return;
      }
      studyQueue = weak;
      studyIdx = 0;
      fcFlipped = false;
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById('view-flashcards').classList.add('active');
      fcShowCard();
    }

    // ============================================================
    //  CONTINUE STUDYING
    // ============================================================
    function continueStudying() {
      const due = getDueCards();
      if (due.length === 0) {
        alert('🎉 All caught up! No cards due for review.');
        return;
      }
      const deckDue = {};
      due.forEach(c => { deckDue[c.deck_id] = (deckDue[c.deck_id] || 0) + 1 });
      currentDeckId = Object.entries(deckDue).sort((a, b) => b[1] - a[1])[0][0];
      openStudySelect();
    }

async function deleteDeck(deckId) {
  if (!isAdmin) {
    alert('Only admins can delete decks.');
    return;
  }

  const isSharedDeck = allCards.some(c => c.deck_id === deckId && c.isShared);
  
  if (isSharedDeck) {
    if (!confirm('Delete this shared deck? All users will lose this deck.')) return;
    try {
      const docId = deckId.replace('shared_', '');
      await db.collection('sharedDecks').doc(docId).delete();
      
      // ===== HAPUS DARI allCards USER SAAT INI =====
      allCards = allCards.filter(c => c.deck_id !== deckId);
      await saveUserData(currentUser);
      
    } catch (error) {
      alert('❌ Failed to delete shared deck: ' + error.message);
      return;
    }
  } else {
    if (!confirm('Delete this deck and all its cards?')) return;
    allCards = allCards.filter(c => c.deck_id !== deckId);
  }

  await saveUserData(currentUser);
  renderDecks();
  updateHome();
  
  if (document.getElementById('view-admin-import').classList.contains('active')) {
    renderAdminDeckList();
  }
  
  alert('✅ Deck deleted successfully!');
}
