function mergeProgress(sharedCards, progressCards) {
    if (!sharedCards || sharedCards.length === 0) return [];
    
    const progressMap = new Map();
    if (progressCards && progressCards.length > 0) {
        progressCards.forEach(c => {
            const key = c.__id || c.card_id;
            if (key) progressMap.set(key, c);
        });
    }
    
    return sharedCards.map(card => {
        const key = card.__id || card.card_id;
        const progress = progressMap.get(key) || {};
        return {
            ...card,
            ...DEFAULT_PROGRESS,
            ...progress
        };
    });
}

 function applySRS(card, quality) {

  let ef = card.ease_factor || 2.5;
  let interval = card.interval || 0;
  let reps = card.repetitions || 0;

  const mult =
      parseFloat(
          document.getElementById('interval-input')?.value
      ) || 1.0;

  if (quality < 1) {

      reps = 0;
      interval = 1;

  } else {

      if (reps === 0) {
          interval = 1;
      }
      else if (reps === 1) {
          interval = 6;
      }
      else {
          interval = Math.round(
              interval * ef * mult
          );
      }

      if (interval < 1) interval = 1;

      reps++;
  }

  ef = ef + (
      0.1 -
      (3 - quality) *
      (0.08 + (3 - quality) * 0.02)
  );

  if (ef < 1.3) ef = 1.3;

  const next = new Date();
  next.setDate(
      next.getDate() + interval
  );

  const reviewDate = today();

  // Prevent duplicate same-day entries
  let history = card.review_history || [];

  if (!history.includes(reviewDate)) {
      history.push(reviewDate);
  }

  return {

      ...card,

      ease_factor:
          Math.round(ef * 100) / 100,

      interval,

      repetitions: reps,

      next_review:
          next.toISOString()
          .split('T')[0],

      last_review:
          new Date()
          .toLocaleString('sv-SE'),

      total_reviews:
          (card.total_reviews || 0) + 1,

      correct_count:
          (card.correct_count || 0) +
          (quality >= 2 ? 1 : 0),

      review_history: history
  };
}

// ============================================================
// FLASHCARDS MODE
// ============================================================
function startFlashcards() {

    // Free user tidak boleh flashcard deck premium
    if (
        !isPremiumActive() &&
        isCurrentDeckPremium()
    ){
        return;
    }

    let allCardsInDeck;

    resetSessionStats();

    // Challenge mode
    if (challengeMode) {

        allCardsInDeck = challengeCards;

    } else {

        allCardsInDeck =
            getRealCards().filter(
                c => c.deck_id === currentDeckId
            );

    }

    if (allCardsInDeck.length === 0) {
        alert('❌ No cards available.');
        return;
    }

    const dueCards =
        challengeMode
        ? allCardsInDeck
        : getDueCards(currentDeckId);

    studyQueue =
        dueCards.length > 0
        ? dueCards
        : allCardsInDeck;

    // Shuffle
    for (
        let i = studyQueue.length - 1;
        i > 0;
        i--
    ) {

        const j = Math.floor(
            Math.random() * (i + 1)
        );

        [studyQueue[i], studyQueue[j]] =
        [studyQueue[j], studyQueue[i]];
    }

    sessionStats = {
        again: 0,
        hard: 0,
        good: 0,
        easy: 0
    };

    studyIdx = 0;
    fcFlipped = false;

    document
        .querySelectorAll('.view')
        .forEach(v => {

            v.classList.remove('active');
            v.style.display='none';

        });

    const flashcardView =
        document.getElementById(
            'view-flashcards'
        );

    if (flashcardView){

        flashcardView.classList.add(
            'active'
        );

        flashcardView.style.display =
            'flex';
    }

    fcShowCard();
}
// ======================================================
// CHALLENGE MODE
// ======================================================

let challengeMode = false;
let challengeCards = [];

function startRandomChallenge(cardCount){

    let cards = getRealCards();

    // Free user → hanya non-premium
    if(!isPremiumActive()){

        cards = cards.filter(
            c => !c.isPremium
        );

    }

    if(!cards.length){
        alert("❌ No cards available");
        return;
    }

    // Shuffle
    const shuffled =
        [...cards].sort(
            ()=>Math.random()-0.5
        );

    // Take selected amount
    challengeCards =
        shuffled.slice(
            0,
            Math.min(
                cardCount,
                cards.length
            )
        );

    challengeMode = true;

    studyQueue = challengeCards;
    studyIdx = 0;
    fcFlipped = false;

    document
        .querySelectorAll('.view')
        .forEach(v=>{

            v.classList.remove(
                'active'
            );

            v.style.display='none';

        });

    const flashcardView =
        document.getElementById(
            'view-flashcards'
        );

    if(flashcardView){

        flashcardView.classList.add(
            'active'
        );

        flashcardView.style.display =
            'flex';

    }

    fcShowCard();
}

function startCustomChallenge(){

    const availableCards =
        isPremiumActive()
        ? getRealCards()
        : getRealCards().filter(
            c=>!c.isPremium
        );

    const total =
        availableCards.length;

    let amount = prompt(
        `Choose number of cards (1-${total})`
    );

    if(!amount) return;

    amount = parseInt(amount);

    if(
        isNaN(amount) ||
        amount<1 ||
        amount>total
    ){
        alert(
            "❌ Invalid amount"
        );
        return;
    }

    startRandomChallenge(
        amount
    );
}

function showCustomChallenge(){
    startCustomChallenge();
}
    
function fcShowCard() {

    const card = document.getElementById('fc-card');
    const done = document.getElementById('fc-done');
    const btns = document.getElementById('fc-buttons');
    const hint = document.querySelector('.swipe-hint');

    // ===== Session Finished =====
    if (
        !studyQueue ||
        studyQueue.length === 0 ||
        studyIdx >= studyQueue.length
    ) {

        if (card) {
    card.style.display = 'none';
    card.style.height = '0';
    card.style.margin = '0';
}

        if (btns) {
            btns.classList.add('hidden');
            btns.style.display = 'none';
        }

        if (hint) {
            hint.style.display = 'none';
        }

        if (done) {

            const total =
                Number(sessionStats.again || 0) +
                Number(sessionStats.hard || 0) +
                Number(sessionStats.good || 0) +
                Number(sessionStats.easy || 0);

            done.innerHTML = `
            <div class="session-summary">

                <h2>🎉 All Done!</h2>

                <p class="summary-sub">
                    Session completed
                </p>

                <div class="summary-grid">

                    <div class="summary-box">
                        <span>${sessionStats.again || 0}</span>
                        <small>Again</small>
                    </div>

                    <div class="summary-box">
                        <span>${sessionStats.hard || 0}</span>
                        <small>Hard</small>
                    </div>

                    <div class="summary-box">
                        <span>${sessionStats.good || 0}</span>
                        <small>Good</small>
                    </div>

                    <div class="summary-box">
                        <span>${sessionStats.easy || 0}</span>
                        <small>Easy</small>
                    </div>

                </div>

                <p class="summary-total">
                    ${total} cards reviewed
                </p>

                <button onclick="goBackAfterStudy()"
class="back-btn mt-4 accent-bg text-white px-6 py-2.5 rounded-2xl font-bold">
Back
</button>

            </div>
            `;

            done.classList.remove('hidden');
            done.style.display = 'flex';
        }

        const progress =
            document.getElementById('fc-progress');

        if (progress) {
            progress.textContent =
                `${studyQueue.length}/${studyQueue.length}`;
        }

        const progressFill =
            document.getElementById('fc-progress-fill');

        if (progressFill) {
            progressFill.style.width = '100%';
        }

        challengeMode = false;
        challengeCards = [];

        if (
            typeof lucide !== 'undefined' &&
            lucide.createIcons
        ) {
            lucide.createIcons();
        }

        return;
    }

    // ===== Normal Card View =====

    if (card) {
    card.style.display = '';
    card.style.height = '';
    card.style.margin = '';
    card.classList.remove('flipped');
}

    if (done) {
        done.classList.add('hidden');
        done.style.display = 'none';
    }

    if (btns) {
        btns.classList.add('hidden');
        btns.style.display = 'none';
    }

    if (hint) {
        hint.style.display = '';
    }

    const c = studyQueue[studyIdx];

if (!c) {
    studyIdx++;
    fcShowCard();
    return;
}

// ===== Card source / subtopic =====
const sourceLabel =
    document.getElementById(
        'challenge-source'
    );

if(sourceLabel){

    const deck =
        getDecks().find(
            d => d.id === c.deck_id
        );

    sourceLabel.textContent =
        deck?.subtopic ||
        deck?.name ||
        '';

    sourceLabel.classList.remove(
        'hidden'
    );
}

    const frontText =
        document.getElementById(
            'fc-front-text'
        );

    const backText =
        document.getElementById(
            'fc-back-text'
        );

    if (frontText) {
        frontText.textContent =
            c.card_front || 'Empty';
    }

    if (backText) {
        backText.textContent =
            c.card_back || 'Empty';
    }

    fcFlipped = false;

    const progress =
        document.getElementById(
            'fc-progress'
        );

    if (progress) {
        progress.textContent =
            `${studyIdx + 1}/${studyQueue.length}`;
    }

    const progressFill =
        document.getElementById(
            'fc-progress-fill'
        );

    if (progressFill) {
        progressFill.style.width =
            `${((studyIdx + 1) / studyQueue.length) * 100}%`;
    }

    if (
        typeof lucide !== 'undefined' &&
        lucide.createIcons
    ) {
        lucide.createIcons();
    }
}

    function goBackAfterStudy(){

    studyQueue = [];
    studyIdx = 0;
    fcFlipped = false;

    document.querySelectorAll('.view')
        .forEach(v=>{
            v.classList.remove('active');
            v.style.display='none';
        });

    const view =
        document.getElementById(
            'view-' + previousView
        );

    if(view){
        view.classList.add('active');
        view.style.display='flex';
    }

    currentTab = previousView;

    document.querySelectorAll('.nav-item')
        .forEach(btn=>{
            btn.classList.toggle(
                'active',
                btn.dataset.tab===previousView
            );
        });

    if(previousView==='decks'){
        renderDecks();
    }

    updateHome();

    if(typeof lucide!=='undefined'){
        lucide.createIcons();
    }
}
    
    function fcFlip() {
      if (studyIdx >= studyQueue.length) return;
      if (!fcFlipped) {
        const card = document.getElementById('fc-card');
        if (card) card.classList.add('flipped');
        fcFlipped = true;
        const btns = document.getElementById('fc-buttons');
        if (btns) {
          btns.classList.remove('hidden');
          btns.style.display = '';
        }
      }
    }

function fcRate(q){

    if(q===0){
        sessionStats.again =
            (sessionStats.again || 0) + 1;
    }
    else if(q===1){
        sessionStats.hard =
            (sessionStats.hard || 0) + 1;
    }
    else if(q===2){
        sessionStats.good =
            (sessionStats.good || 0) + 1;
    }
    else if(q===3){
        sessionStats.easy =
            (sessionStats.easy || 0) + 1;
    }

    if (!studyQueue || studyIdx >= studyQueue.length){
        exitStudy();
        return;
    }

    const c = studyQueue[studyIdx];
    const updated = applySRS(c, q);

    const idx = allCards.findIndex(
        x => x.__id === updated.__id
    );

    if(idx !== -1){
        allCards[idx] = updated;
    } else {
        allCards.push(updated);
    }

    saveUserData(currentUser)
        .catch(console.error);

    addStudyTime(0.5);

    studyIdx++;

    fcShowCard();

    updateHome();
}
    // ============================================================
    //  EXIT STUDY - COMPLETE RESET
    // ============================================================
   function exitStudy() {
    // Reset study state
    studyQueue = [];
    studyIdx = 0;
    fcFlipped = false;

    // Reset challenge mode
    challengeMode = false;
    challengeCards = [];

    // ===== Learn mode reset =====
    const lnAnswerBox = document.getElementById('ln-answer-box');
    const lnShowBtn = document.getElementById('ln-show-btn');
    const lnGradeBtns = document.getElementById('ln-grade-btns');
    const lnDone = document.getElementById('ln-done');
    const lnProgressFill = document.getElementById('ln-progress-fill');
    const lnProgress = document.getElementById('ln-progress');

    if (lnAnswerBox) lnAnswerBox.classList.add('hidden');
    if (lnShowBtn) lnShowBtn.style.display = '';
    if (lnGradeBtns) lnGradeBtns.classList.add('hidden');

    if (lnDone) {
        lnDone.classList.add('hidden');
        lnDone.style.display = 'none';
    }

    if (lnProgressFill) lnProgressFill.style.width = '0%';
    if (lnProgress) lnProgress.textContent = '0/0';


    // ===== Test mode reset =====
    const tsResults = document.getElementById('ts-results');
    const tsQuestionArea = document.getElementById('ts-question-area');
    const tsProgressFill = document.getElementById('ts-progress-fill');
    const tsProgress = document.getElementById('ts-progress');

    if (tsResults) {
        tsResults.classList.add('hidden');
        tsResults.style.display = 'none';
    }

    if (tsQuestionArea) tsQuestionArea.style.display = '';

    if (tsProgressFill) tsProgressFill.style.width = '0%';
    if (tsProgress) tsProgress.textContent = '0/0';


    // ===== Study select reset =====
    const studySelect = document.getElementById('view-study-select');

    if (studySelect) {
        studySelect.classList.remove('active');
        studySelect.style.display = 'none';
    }


    // ===== Flashcard reset =====
    const btns = document.getElementById('fc-buttons');
    const done = document.getElementById('fc-done');
    const card = document.getElementById('fc-card');
    const hint = document.querySelector('.swipe-hint');
    const fcProgress = document.getElementById('fc-progress');
    const fcProgressFill = document.getElementById('fc-progress-fill');

    if (btns) {
        btns.classList.add('hidden');
        btns.style.display = 'none';
    }

    if (done) {
        done.classList.add('hidden');
        done.style.display = 'none';
    }

    if (card) {
        card.style.display = '';
        card.classList.remove('flipped');
    }

    if (hint) hint.style.display = '';

    if (fcProgress) fcProgress.textContent = '0/0';
    if (fcProgressFill) fcProgressFill.style.width = '0%';


    // ===== Hide study pages =====
    const studyViews = [
        'view-flashcards',
        'view-learn',
        'view-test'
    ];

    studyViews.forEach(id => {
        const el = document.getElementById(id);

        if (el) {
            el.classList.remove('active');
            el.style.display = 'none';
        }
    });


    // ===== Return to HOME =====
    const homeView = document.getElementById('view-home');

    if (homeView) {
        homeView.classList.add('active');
        homeView.style.display = 'flex';
    }

    document.querySelectorAll('.nav-item').forEach(b => {
        b.classList.toggle(
            'active',
            b.dataset.tab === 'home'
        );
    });

    currentTab = 'home';

    renderDecks();
    updateHome();


    // ===== Icons refresh =====
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }

    // ===== Clear navigation timeout =====
    if (navTimeout) {
        clearTimeout(navTimeout);
        navTimeout = null;
    }
}

    // ============================================================
    //  LEARN MODE
    // ============================================================
    function startLearn() {

     if (!isPremiumActive()){
    return;
}
      studyQueue = getDueCards(currentDeckId);
      if (studyQueue.length === 0) studyQueue = getRealCards().filter(c => c.deck_id === currentDeckId);
      if (studyQueue.length === 0) { alert('No cards.'); return }
      studyIdx = 0;
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById('view-learn').classList.add('active');
      lnShowQuestion();
    }

    function lnShowQuestion() {
      const done = document.getElementById('ln-done'),
        qBox = document.getElementById('ln-question'),
        aBox = document.getElementById('ln-answer-box'),
        showBtn = document.getElementById('ln-show-btn'),
        gradeB = document.getElementById('ln-grade-btns');
      if (studyIdx >= studyQueue.length) {
        qBox.style.display = 'none';
        aBox.classList.add('hidden');
        showBtn.style.display = 'none';
        gradeB.classList.add('hidden');
        done.classList.remove('hidden');
        done.style.display = 'flex';
        document.getElementById('ln-progress-fill').style.width = '100%';
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
          lucide.createIcons();
        }
        return;
      }
      qBox.style.display = '';
      done.classList.add('hidden');
      done.style.display = 'none';
      aBox.classList.add('hidden');
      showBtn.style.display = '';
      gradeB.classList.add('hidden');
      const c = studyQueue[studyIdx];
      document.getElementById('ln-front-text').textContent = c.card_front;
      document.getElementById('ln-back-text').textContent = c.card_back;
      document.getElementById('ln-progress').textContent = `${studyIdx + 1}/${studyQueue.length}`;
      document.getElementById('ln-progress-fill').style.width = `${(studyIdx / studyQueue.length) * 100}%`;
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    }

    function lnShowAnswer() {
      document.getElementById('ln-answer-box').classList.remove('hidden');
      document.getElementById('ln-show-btn').style.display = 'none';
      document.getElementById('ln-grade-btns').classList.remove('hidden');
    }

   function lnGrade(correct) {
  const c = studyQueue[studyIdx];
  const updated = applySRS(c, correct ? 2 : 0);
  
  const idx = allCards.findIndex(x => x.__id === updated.__id);
  if (idx !== -1) allCards[idx] = updated;
  else allCards.push(updated);
  
  saveUserData(currentUser)
  .catch(console.error);
  addStudyTime(0.5);
  studyIdx++;
  lnShowQuestion();
  
  setTimeout(() => updateHome(), 100);
}

    // ============================================================
    //  TEST MODE
    // ============================================================
    function startTest() {
 if (!isPremiumActive()){
    return;
}
  const all = getRealCards().filter(c => c.deck_id === currentDeckId);
  if (all.length === 0) { alert('No cards.'); return }
  const shuffled = [...all];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  studyQueue = shuffled.slice(0, 10);
  studyIdx = 0;
  tsCorrect = 0;
  tsIncorrect = 0;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-test').classList.add('active');
  tsShowQuestion();
}

function toggleFAQ(button) {
  const answer = button.nextElementSibling;
  const icon = button.querySelector('[data-lucide]');
  
  if (!answer) return;
  
  answer.classList.toggle('hidden');
  
  if (icon) {
    icon.style.transform = answer.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
  }
}
    
    function tsShowQuestion() {
      const results = document.getElementById('ts-results'),
        qArea = document.getElementById('ts-question-area'),
        fb = document.getElementById('ts-feedback'),
        choices = document.getElementById('ts-choices'),
        typeArea = document.getElementById('ts-type-area');
      if (studyIdx >= studyQueue.length) {
        qArea.style.display = 'none';
        results.classList.remove('hidden');
        results.style.display = 'flex';
        const pct = studyQueue.length > 0 ? Math.round(tsCorrect / studyQueue.length * 100) : 0;
        document.getElementById('ts-score').textContent = pct + '%';
        document.getElementById('ts-correct-count').textContent = tsCorrect;
        document.getElementById('ts-incorrect-count').textContent = tsIncorrect;
        document.getElementById('ts-progress-fill').style.width = '100%';
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
          lucide.createIcons();
        }
        return;
      }
      qArea.style.display = '';
      results.classList.add('hidden');
      results.style.display = 'none';
      fb.classList.add('hidden');
      const c = studyQueue[studyIdx];
      document.getElementById('ts-question').textContent = c.card_front;
      tsCurrentAnswer = c.card_back;
      document.getElementById('ts-progress').textContent = `${studyIdx + 1}/${studyQueue.length}`;
      document.getElementById('ts-progress-fill').style.width = `${(studyIdx / studyQueue.length) * 100}%`;

      if (Math.random() > 0.4 && getRealCards().length >= 4) {
        choices.classList.remove('hidden');
        typeArea.classList.add('hidden');
        const options = [c.card_back];
        const others = getRealCards().filter(x => x.__id !== c.__id && x.deck_id === currentDeckId).map(x => x.card_back)
          .filter(Boolean);
        while (options.length < 4 && others.length > 0) { const idx = Math.floor(Math.random() * others.length); if (!options
            .includes(others[idx])) options.push(others[idx]);
          others.splice(idx, 1) }
        for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));
          [options[i], options[j]] = [options[j], options[i]] }
        choices.innerHTML = options.map(o =>
          `<button onclick="tsChoose('${o.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" class="choice-btn">${o}</button>`
        ).join('');
      } else {
        choices.classList.add('hidden');
        typeArea.classList.remove('hidden');
        document.getElementById('ts-type-input').value = '';
        setTimeout(() => document.getElementById('ts-type-input').focus(), 100);
      }
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    }

    function tsChoose(answer) { const c = answer === tsCurrentAnswer; if (c) tsCorrect++;
      else tsIncorrect++;
      tsShowFeedback(c) }

    function tsSubmitTyped() {
      const val = document.getElementById('ts-type-input').value.trim().toLowerCase();
      const c = val === tsCurrentAnswer.toLowerCase();
      if (c) tsCorrect++;
      else tsIncorrect++;
      tsShowFeedback(c);
    }

    function tsShowFeedback(correct) {
      document.getElementById('ts-choices').classList.add('hidden');
      document.getElementById('ts-type-area').classList.add('hidden');
      const fb = document.getElementById('ts-feedback');
      fb.classList.remove('hidden');
      fb.style.background = correct ? 'var(--card-green)' : 'var(--card-peach)';
      document.getElementById('ts-feedback-text').textContent = correct ? '✅ Correct!' : '❌ Incorrect';
      document.getElementById('ts-feedback-text').style.color = correct ? '#059669' : '#dc2626';
      document.getElementById('ts-correct-answer').textContent = correct ? '' : 'Answer: ' + tsCurrentAnswer;
      const c = studyQueue[studyIdx];
      const updated = applySRS(c, correct ? 2 : 0);
      const idx = allCards.findIndex(x => x.__id === updated.__id);
      if (idx !== -1) allCards[idx] = updated;
      else allCards.push(updated);
      saveUserData(currentUser)
  .catch(console.error);
      addStudyTime(0.5);
      setTimeout(() => updateHome(), 100);
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    }

    function tsNext() { studyIdx++;
      tsShowQuestion() }
