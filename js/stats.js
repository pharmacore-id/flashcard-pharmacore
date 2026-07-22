// ============================================================
    //  STATS RENDERING
    // ============================================================
    function renderStats() {
      const real = getRealCards();
      const total = real.reduce((s, c) => s + (c.total_reviews || 0), 0);
      const correct = real.reduce((s, c) => s + (c.correct_count || 0), 0);
      const acc = total > 0 ? Math.round(correct / total * 100) : 0;
      const mastered = real.filter(c => (c.interval || 0) >= 21).length;
      const streak = getStreak();

      const streakVal = document.getElementById('stats-streak-val');
      if (streakVal) streakVal.textContent = streak + ' days';

      const accEl = document.getElementById('stats-acc');
      if (accEl) accEl.textContent = acc + '%';

      const totalEl = document.getElementById('stats-total');
      if (totalEl) totalEl.textContent = total;

      const masteredEl = document.getElementById('stats-mastered-val');
      if (masteredEl) masteredEl.textContent = mastered;

      loadDailyGoal();
      renderProgressChart();
      renderDeckPerformance();
      renderRetentionRate();
      renderAvgCards();
      renderSubjectBreakdown();
      renderHeatmap();
    }

 // ============================================================
    //  1. PROGRESS CHART
    // ============================================================
  function renderProgressChart() {
    const days = progressPeriod === 'week' ? 7 : progressPeriod === 'month' ? getDaysInMonth() : 60;
    const dates = getDateRangeForPeriod(days);
    const counts = dates.map(d => getTotalReviewsForDate(d));
    const maxCount = Math.max(...counts, 1);

    const container = document.getElementById('progress-chart');
    if (!container) return;

    container.className = 'flex items-end gap-1';
    container.style.minHeight = '80px';
    container.style.width = '100%';
    container.style.padding = '4px 2px 4px 2px';
    container.style.flexWrap = 'nowrap';
    container.style.overflowX = 'auto';

    if (days > 14) container.classList.add('month');
    if (days > 40) container.classList.add('all');

    // ============================================================
    //  HITUNG LABEL STEP
    // ============================================================
    let labelStep = 1;
    if (days > 7 && days <= 31) {
        labelStep = 5;
    }
    if (days > 31) {
        labelStep = 10;
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const barCount = dates.length;
    const containerWidth = container.parentElement?.offsetWidth || 320;
    const gapTotal = (barCount - 1) * 3;
    const availableWidth = containerWidth - 16 - gapTotal;

    // ============================================================
    //  HITUNG LEBAR BAR - FIX UNTUK MONTH & ALL
    // ============================================================
    let barWidth = Math.max(Math.min(availableWidth / barCount, 30), 10);

    // Month (28-31 hari) → lebih lebar agar label terbaca
    if (days > 14 && days <= 31) {
        barWidth = Math.max(barWidth, 18);
    }

    // All (60 hari) → lebih lebar dari sebelumnya
    if (days > 31) {
        barWidth = Math.max(Math.min(availableWidth / barCount, 18), 8);
    }

    container.innerHTML = dates.map((d, i) => {
        const height = Math.max((counts[i] / maxCount) * 55, 3);
        const isToday = d === today();
        const hasValue = counts[i] > 0;
        const dateObj = new Date(d);
        const day = dateObj.getDate();
        const month = months[dateObj.getMonth()];

        let showLabel = false;
        let labelText = '';

        // ============================================================
        //  WEEK (7 hari) → tampil semua
        // ============================================================
        if (days === 7) {
            const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            showLabel = true;
            labelText = dayNames[i];
        }
        // ============================================================
        //  MONTH (28-31 hari) → tanggal + bulan hanya di tanggal 1
        // ============================================================
        else if (days <= 31) {
            showLabel = true;
            const showMonth = day === 1;
            labelText = `
                <div style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    line-height: 1;
                ">
                    <span>${day}</span>
                    <span style="
                        font-size: 5px;
                        opacity: .7;
                        min-height: 6px;
                        margin-top: 2px;
                    ">
                        ${showMonth ? month : ''}
                    </span>
                </div>
            `;
        }
        // ============================================================
        //  ALL (60 hari) → tampil tiap labelStep
        // ============================================================
        else {
            showLabel = i === 0 || i === dates.length - 1 || i % labelStep === 0;
            labelText = `
                <div style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    line-height: 1;
                ">
                    <span>${day}</span>
                    <span style="
                        font-size: 5px;
                        opacity: .7;
                        min-height: 6px;
                        margin-top: 2px;
                    ">
                        ${month}
                    </span>
                </div>
            `;
        }

        return `
            <div class="bar-group" style="
                width: ${barWidth}px;
                flex: 0 0 ${barWidth}px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
            ">
                <span class="bar-value" style="
                    font-size: 8px;
                    font-weight: 700;
                    color: var(--text-secondary);
                    line-height: 1;
                    min-height: 12px;
                ">${counts[i] > 0 ? counts[i] : ''}</span>
                <div class="bar ${hasValue ? 'filled' : ''} ${isToday ? 'today' : ''}" 
                     style="
                         height: ${height}px; 
                         width: 100%; 
                         max-width: ${barWidth}px;
                         border-radius: 3px 3px 0 0;
                         background: ${hasValue ? 'var(--accent)' : 'var(--border)'};
                         transition: height 0.3s ease;
                     ">
                </div>
                <div class="bar-label" style="
                    width: 100%;
                    text-align: center;
                    min-height: 18px;
                    line-height: 1;
                ">
                    ${showLabel ? labelText : ''}
                </div>
            </div>
        `;
    }).join('');

    // ============================================================
    //  UPDATE LABEL TOTAL
    // ============================================================
    const totalInPeriod = counts.reduce((a, b) => a + b, 0);
    const periodLabel = progressPeriod === 'week' ? 'this week' : progressPeriod === 'month' ? 'this month' : 'all time';
    const totalLabel = document.getElementById('progress-total-label');
    if (totalLabel) {
        totalLabel.textContent = `${totalInPeriod} cards ${periodLabel}`;
    }

    // ============================================================
    //  UPDATE STREAK MESSAGE
    // ============================================================
    const streak = getStreak();
    const streakMsg = document.getElementById('progress-streak-msg');
    if (streakMsg) {
        if (streak >= 30) {
            streakMsg.textContent = `🔥 ${streak}-day streak! Unstoppable! 🔥`;
            streakMsg.style.color = 'var(--premium-gold)';
        } else if (streak >= 14) {
            streakMsg.textContent = `🔥 ${streak}-day streak! You're on fire! 🔥`;
            streakMsg.style.color = 'var(--accent)';
        } else if (streak >= 7) {
            streakMsg.textContent = `🔥 ${streak}-day streak! Amazing! Keep going!`;
            streakMsg.style.color = 'var(--accent)';
        } else if (streak >= 3) {
            streakMsg.textContent = `🔥 ${streak}-day streak! You're building momentum!`;
            streakMsg.style.color = 'var(--accent)';
        } else if (streak > 0) {
            streakMsg.textContent = `🔥 ${streak}-day streak! Every day counts!`;
            streakMsg.style.color = 'var(--accent)';
        } else {
            streakMsg.textContent = '📖 Start your streak today! Study at least one card.';
            streakMsg.style.color = 'var(--text-secondary)';
        }
    }
}
  // ============================================================
//  2. DECK PERFORMANCE (scroll vertikal)
// ============================================================
function renderDeckPerformance() {
  const perf = getDeckPerformance();
  const container = document.getElementById('deck-performance-list');
  if (!container) return;

  if (perf.length === 0) {
    container.innerHTML = '<p class="text-xs text-sec">No decks yet.</p>';
    return;
  }
  
  container.style.maxHeight = '300px';
  container.style.overflowY = 'auto';
  
  container.innerHTML = perf.map(d => {
    const displayName = d.name.includes(' - ') ? d.name.split(' - ').pop() : d.name;
    const color = d.accuracy >= 80 ? '#059669' : d.accuracy >= 60 ? '#f59e0b' : '#ef4444';
    return `<div class="deck-perf-bar">
              <span class="name" title="${displayName}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">${displayName}</span>
              <div class="bar-track"><div class="bar-fill" style="width:${d.accuracy}%; background:${color};"></div></div>
              <span class="pct" style="color:${color}">${d.accuracy}%</span>
            </div>`;
  }).join('');
}
    // ============================================================
    //  3. RETENTION RATE
    // ============================================================
    function renderRetentionRate() {
      const ret = getRetentionRates();
      const overallEl = document.getElementById('ret-overall');
      if (overallEl) overallEl.textContent = ret.overall + '%';
      const ret7El = document.getElementById('ret-7d');
      if (ret7El) ret7El.textContent = ret.d7 + '%';
      const ret14El = document.getElementById('ret-14d');
      if (ret14El) ret14El.textContent = ret.d14 + '%';
      const ret30El = document.getElementById('ret-30d');
      if (ret30El) ret30El.textContent = ret.d30 + '%';
    }

  // ============================================================
    //  4. AVERAGE CARDS/DAY
    // ============================================================
    function renderAvgCards() {
      const avgWeek = getAvgCardsPerDay(7);
      const avgMonth = getAvgCardsPerDay(30);
      const bestDay = getBestDay(30);
      const goal = getDailyGoal();

      const avgWeekEl = document.getElementById('avg-week');
      if (avgWeekEl) avgWeekEl.textContent = avgWeek;
      const avgMonthEl = document.getElementById('avg-month');
      if (avgMonthEl) avgMonthEl.textContent = avgMonth;
      const bestDayEl = document.getElementById('best-day');
      if (bestDayEl) bestDayEl.textContent = bestDay;
      const avgGoalEl = document.getElementById('avg-goal');
      if (avgGoalEl) avgGoalEl.textContent = goal;
    }

    // ============================================================
    //  5. SUBJECT BREAKDOWN
    // ============================================================
    function renderSubjectBreakdown() {
      const subjects = getSubjectBreakdown();
      const container = document.getElementById('subject-breakdown-list');
      if (!container) return;

      const total = Object.values(subjects).reduce((a, b) => a + b, 0);
      if (total === 0) {
        container.innerHTML = '<p class="text-xs text-sec">No subjects yet.</p>';
        return;
      }

      const sorted = Object.entries(subjects).sort((a, b) => b[1] - a[1]);
      container.innerHTML = sorted.map(([name, count]) => {
        const pct = Math.round((count / total) * 100);
        return `<div class="subject-item">
                  <span class="name" title="${name}">${name}</span>
                  <div class="bar-track"><div class="bar-fill" style="width:${pct}%;"></div></div>
                  <span class="pct">${pct}%</span>
                </div>`;
      }).join('');
    }

// ============================================================
    //  6. STUDY HEATMAP
    // ============================================================
    function renderHeatmap() {
  const container = document.getElementById('heatmap-container');
  if (!container) return;

  const weeks = 4;
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const todayDate = new Date();
  const firstDay = new Date(todayDate);
  // Mundur ke Senin pertama (4 minggu lalu)
  firstDay.setDate(firstDay.getDate() - (firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1));
  firstDay.setDate(firstDay.getDate() - (weeks - 1) * 7);

  // Kumpulkan semua count untuk mencari nilai maksimum
  const allCounts = [];
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(firstDay);
      date.setDate(date.getDate() + w * 7 + d);
      const dateStr = formatLocalDate(date);
      allCounts.push(getTotalReviewsForDate(dateStr));
    }
  }
  const maxCount = Math.max(...allCounts, 1); // minimal 1 agar tidak dibagi nol

  let html = `<div class="heatmap-grid">`;
  days.forEach(d => {
    html += `<div class="day-label">${d}</div>`;
  });

  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(firstDay);
      date.setDate(date.getDate() + w * 7 + d);
      const dateStr = formatLocalDate(date);
      const isToday = dateStr === today();
      const count = getTotalReviewsForDate(dateStr);

      let cls = 'heat-cell';
      if (isToday) cls += ' today';

      // Hitung intensitas (0.25 untuk 1 kartu, 1.0 untuk max)
      const intensity = count > 0 ? 0.25 + (count / maxCount) * 0.75 : 0;
      const bgColor = count > 0
        ? `rgba(249, 115, 22, ${intensity.toFixed(2)})` // oranye dengan opacity bervariasi
        : 'var(--border)'; // abu‑abu default

      const label = count > 0 ? count : '';

      html += `<div class="${cls}" style="background:${bgColor};" title="${dateStr}: ${count} cards">${label}</div>`;
    }
  }
  html += `</div>`;
  container.innerHTML = html;
}

// ============================================================
    //  PROGRESS TOGGLE
    // ============================================================
    document.addEventListener('DOMContentLoaded', function() {
      const toggle = document.getElementById('progress-toggle');
      if (toggle) {
        toggle.addEventListener('click', function(e) {
          const btn = e.target.closest('button');
          if (!btn || !btn.dataset.period) return;
          document.querySelectorAll('#progress-toggle button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          progressPeriod = btn.dataset.period;
          renderStats();
        });
      }
    });
