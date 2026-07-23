const DEFAULT_DAILY_GOAL = 50;
const MAX_DAILY_GOAL = 1000;
const ALL_TIME_DAYS = 60;
const MAX_STREAK_DAYS = 5000;

 function buildProgressData() {
  return allCards
    .filter(c => c.__id)
    .map(c => ({
      __id: c.__id,
      ease_factor: c.ease_factor ?? 2.5,
      interval: c.interval ?? 0,
      repetitions: c.repetitions ?? 0,
      total_reviews: c.total_reviews ?? 0,
      correct_count: c.correct_count ?? 0,
      next_review: c.next_review || '',
      last_review: c.last_review || '',
      review_history: c.review_history || []
    }));
}

function createProgressSnapshot() {
    return {
        cards: buildProgressData(),
        plan: userPlan,
        schema_version: CURRENT_SCHEMA_VERSION
    };
}

function getDateRange(days) {
      const dates = [];
      const now = new Date();
      if (days === 7) {
        // Mulai dari Senin minggu ini hingga Minggu
        const dayOfWeek = now.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // berapa hari ke belakang untuk mencapai Senin
        for (let i = 0; i < 7; i++) {
          const d = new Date(now);
          d.setDate(d.getDate() + mondayOffset + i);
          dates.push(formatLocalDate(d));
        }
      } else if (days === 30) {
        const year = now.getFullYear();
        const month = now.getMonth();
        const todayDate = now.getDate();
        for (let day = 1; day <= todayDate; day++) {
          const d = new Date(year, month, day);
          dates.push(formatLocalDate(d));
        }
      } else {
       for (let i = ALL_TIME_DAYS - 1; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          dates.push(formatLocalDate(d));
        }
      }
      return dates;
    }

    function getDaysInMonth() {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    }

// ============================================================
    //  DAILY GOAL
    // ============================================================
    function getDailyGoal() {
      const key = 'Pharmadeck_goal_' + (currentUser || 'default');
      const saved = localStorage.getItem(key);
      if (saved) {
        const val = parseInt(saved, 10);
        if (val > 0 && val <= MAX_DAILY_GOAL) return val;
      }
      return DEFAULT_DAILY_GOAL;
    }

    function setDailyGoal() {
      const input = document.getElementById('goal-input');
      if (!input) return;
     const val = parseInt(input.value, 10);
      if (isNaN(val) || val < 1 || val > MAX_DAILY_GOAL) {
        alert('Please enter a number between 1 and 500.');
        return;
      }
      const key = 'Pharmadeck_goal_' + (currentUser || 'default');
      localStorage.setItem(key, val);
      loadDailyGoal();
      updateHome();
      renderStats();
      alert('✅ Daily goal updated to ' + val + ' cards!');
    }

    function loadDailyGoal() {
      const goal = getDailyGoal();
      const todayGoal = document.getElementById('today-goal');
      if (todayGoal) todayGoal.textContent = goal;
      const dailyGoalText = document.getElementById('daily-goal-text');
      if (dailyGoalText) dailyGoalText.textContent = 'Goal: ' + goal + ' cards';
      const goalInput = document.getElementById('goal-input');
      if (goalInput) goalInput.value = goal;
      const avgGoal = document.getElementById('avg-goal');
      if (avgGoal) avgGoal.textContent = goal;
    }

    function getTodayStudyCount() {
      const todayStr = today();
      return allCards.filter(c => c.last_review && c.last_review.startsWith(todayStr)).length;
    }

function getCardsByDate(date) {

    return allCards.filter(card => {

        // New system
        if (card.review_history &&
            card.review_history.length > 0) {

            return card.review_history.includes(date);
        }

        // Old cards: convert old data once
        if (
            card.last_review &&
            card.last_review.startsWith(date)
        ) {

            card.review_history = [date];

            return true;
        }

        return false;

    });

}

    function getTotalReviewsForDate(date) {
    return getCardsByDate(date).length;
}
    
    function getSubjectBreakdown() {
      const subjects = {};
      getRealCards().forEach(c => {
        const topic = c.topic || 'General';
        if (!subjects[topic]) subjects[topic] = 0;
        subjects[topic]++;
      });
      return subjects;
    }

    function getDeckPerformance() {
      const decks = getDecks();
      return decks.map(d => {
        const cards = d.cards;
        const total = cards.length;
        const correct = cards.filter(c => (c.correct_count || 0) > 0).length;
        const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
        return { name: d.name, accuracy, total };
      }).sort((a, b) => b.accuracy - a.accuracy);
    }

   function getRetentionRates() {

    const real = getRealCards();

    if (real.length === 0) {
        return {
            overall: 0,
            d7: 0,
            d14: 0,
            d30: 0
        };
    }

    const totalReviews = real.reduce(
        (sum, card) => sum + (card.total_reviews || 0),
        0
    );

    const correctReviews = real.reduce(
        (sum, card) => sum + (card.correct_count || 0),
        0
    );

    const overall =
        totalReviews > 0
            ? Math.round(
                (correctReviews / totalReviews) * 100
            )
            : 0;

    return {
        overall,
        d7: calculateRetention(real, 7),
        d14: calculateRetention(real, 14),
        d30: calculateRetention(real, 30)
    };
}

    function getAvgCardsPerDay(days) {
      const dates = getDateRange(days);
      let total = 0;
      dates.forEach(d => {
        total += getTotalReviewsForDate(d);
      });
      return Math.round(total / dates.length);
    }

    function getBestDay(days) {
      const dates = getDateRange(days);
      let best = 0;
      dates.forEach(d => {
        const count = getTotalReviewsForDate(d);
        if (count > best) best = count;
      });
      return best;
    }

  function getStreak() {
      const reviews = [...new Set(getRealCards().map(c => c.last_review ? formatLocalDate(new Date(c.last_review)) : null).filter(Boolean))];
      let s = 0, d = new Date();
   for (let i = 0; i < MAX_STREAK_DAYS; i++) {
        const ds = formatLocalDate(d);
        if (reviews.includes(ds)) { s++; d.setDate(d.getDate() - 1); } 
        else if (i === 0) { d.setDate(d.getDate() - 1); } 
        else break;
      }
      return s;
    }

   function getStreakDays() {
    const streak = getStreak();
    const days = [];
    for (let i = 0; i < 7; i++) {
        days.push({
            active: i < streak,
            isToday: i === 0,
            isFuture: false
        });}
    return days;
}

function getStudyTimeStorage() {
    return JSON.parse(
        localStorage.getItem(
            STUDY_TIME_KEY + "_" + (currentUser || "default")
        ) || "{}"
    );
}

function getStudyTime() {
    const data = getStudyTimeStorage();

    const todayStr = today();

    if (!data[todayStr]) {
        data[todayStr] = 0;
    }

    return data[todayStr];
}

function addStudyTime(minutes) {
    const data = getStudyTimeStorage();

    const todayStr = today();

    data[todayStr] =
        (data[todayStr] || 0) + minutes;

    localStorage.setItem(
        STUDY_TIME_KEY + "_" + (currentUser || "default"),
        JSON.stringify(data)
    );
}

function calculateRetention(cards, days) {
    const reviewed = cards.filter(card => {
        if (!card.last_review) return false;

        const diff =
            (Date.now() - new Date(card.last_review).getTime()) / 86400000;

        return diff <= days;
    });

    if (reviewed.length === 0) {
        return 0;
    }

    const retained = reviewed.filter(
        card => (card.correct_count || 0) > 0
    );

    return Math.round(
        (retained.length / reviewed.length) * 100
    );
}


