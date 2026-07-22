function updateHome() {
    console.time('⏱️ updateHome');
    
    try {
        const due = getDueCards();
        const dueCount = document.getElementById('due-count');
        if (dueCount) dueCount.textContent = due.length;

        const real = getRealCards();
        const total = real.reduce((s, c) => s + (c.total_reviews || 0), 0);
        const correct = real.reduce((s, c) => s + (c.correct_count || 0), 0);
        const acc = total > 0 ? Math.round(correct / total * 100) : 0;
        const mastered = real.filter(c => (c.interval || 0) >= 21).length;
        const streak = getStreak();

        loadNickname();
        loadDailyGoal();

        const statStreak = document.getElementById('stat-streak');
        if (statStreak) statStreak.textContent = streak;

        const statAccuracy = document.getElementById('stat-accuracy');
        if (statAccuracy) statAccuracy.textContent = acc + '%';

        const statMastered = document.getElementById('stat-mastered');
        if (statMastered) statMastered.textContent = mastered;

        const streakNumber = document.getElementById('streak-number');
        if (streakNumber) streakNumber.textContent = streak;

        const goal = getDailyGoal();
        const todayCount = getTodayStudyCount();

        const dailyProgressFill = document.getElementById('daily-progress-fill');
        if (dailyProgressFill) {
            const pct = Math.min((todayCount / goal) * 100, 100);
            dailyProgressFill.style.width = pct + '%';
        }

        const todayCountEl = document.getElementById('today-count');
        if (todayCountEl) todayCountEl.textContent = todayCount;

        const days = getStreakDays();
        const dayLabels = ['1', '2', '3', '4', '5', '6', '7'];
        const calendar = document.getElementById('streak-calendar');
        if (calendar) {
            calendar.innerHTML = days.map((d, i) => {
                let cls = 'streak-dot';
                if (d.active) {
                    cls += ' active';
                } else {
                    cls += ' inactive';
                }
                if (d.isToday) {
                    cls += ' today';
                }
                return `<div class="${cls}">${dayLabels[i]}</div>`;
            }).join('');
        }

        const lastReview = real.filter(c => c.last_review).sort((a, b) =>
            new Date(b.last_review) - new Date(a.last_review)
        )[0];
        const lastStudyText = document.getElementById('last-study-text');
        if (lastStudyText) {
            if (lastReview) {
                const diff = Math.floor((Date.now() - new Date(lastReview.last_review)) / (1000 * 60));
                if (diff < 1) lastStudyText.textContent = 'Last studied: Just now';
                else if (diff < 60) lastStudyText.textContent = `Last studied: ${diff} min ago`;
                else if (diff < 1440) lastStudyText.textContent =
                    `Last studied: ${Math.floor(diff / 60)}h ${diff % 60}m ago`;
                else lastStudyText.textContent = `Last studied: ${Math.floor(diff / 1440)} days ago`;
            } else {
                lastStudyText.textContent = 'Last studied: Never';
            }
        }

        const btn = document.getElementById('home-review-btn');
        if (btn) {
            if (due.length === 0) {
                btn.textContent = '🎉 All caught up!';
                btn.disabled = true;
                btn.classList.add('opacity-60', 'cursor-not-allowed');
            } else {
                btn.textContent = '📖 Continue Studying';
                btn.disabled = false;
                btn.classList.remove('opacity-60', 'cursor-not-allowed');
            }
        }
        updatePlanUI();
        
    } finally {
        console.timeEnd('⏱️ updateHome');
    }
}
