document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('battery-form');
  const inputSection = document.getElementById('input-section');
  const resultSection = document.getElementById('result-section');
  const recalculateBtn = document.getElementById('recalculate-btn');

  // Result Elements
  const gaugePath = document.getElementById('gauge-path');
  const batteryPercentEl = document.getElementById('battery-percent');
  const batteryStatusEl = document.getElementById('battery-status');
  
  const statBmr = document.getElementById('stat-bmr');
  const statTdee = document.getElementById('stat-tdee');
  const statExercise = document.getElementById('stat-exercise');
  const statSleep = document.getElementById('stat-sleep');
  const statRemaining = document.getElementById('stat-remaining');
  const trendChart = document.getElementById('trend-chart');

  // Constants
  const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 40; // r=40
  
  // Initialize Chart
  renderChart();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    calculateBattery();
  });

  recalculateBtn.addEventListener('click', () => {
    resultSection.classList.remove('active');
    resultSection.classList.add('hidden');
    setTimeout(() => {
      inputSection.classList.remove('hidden');
      inputSection.classList.add('active');
    }, 300);
  });

  function calculateBattery() {
    // 1. Gather Inputs
    const age = parseFloat(document.getElementById('age').value);
    const sex = document.getElementById('sex').value;
    const height = parseFloat(document.getElementById('height').value);
    const weight = parseFloat(document.getElementById('weight').value);
    const activity = document.getElementById('activity').value;
    
    const wakeTimeStr = document.getElementById('wake-time').value; // HH:MM
    const sleepHours = parseFloat(document.getElementById('sleep-hours').value);
    const sleepQuality = parseFloat(document.getElementById('sleep-quality').value);
    
    const exDuration = parseFloat(document.getElementById('exercise-duration').value);
    const exIntensity = parseFloat(document.getElementById('exercise-intensity').value);
    
    const caloriesInput = document.getElementById('calories').value;
    const caloriesConsumed = caloriesInput ? parseFloat(caloriesInput) : 0;

    // 2. Calculations
    // BMR (Mifflin-St Jeor)
    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr += (sex === 'male') ? 5 : -161;

    // TDEE
    const activityMultipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      very: 1.725,
      extra: 1.9
    };
    const tdee = bmr * activityMultipliers[activity];

    // Exercise Expenditure
    // Map intensity 1-10 to METs ~2 to 10
    const met = 2 + (exIntensity - 1) * (8 / 9);
    const exerciseCalories = met * weight * (exDuration / 60);

    // Total Energy Expenditure for today
    const totalExpenditure = tdee + exerciseCalories;

    // Sleep Score (Max 100)
    // Up to 8 hours gets full 50 points, quality 10 gets full 50 points
    const sleepDurationScore = Math.min(sleepHours / 8, 1) * 50;
    const sleepQualityScore = (sleepQuality / 10) * 50;
    const sleepScore = Math.round(sleepDurationScore + sleepQualityScore);

    // Time Awake Drain
    const now = new Date();
    const [wakeHour, wakeMin] = wakeTimeStr.split(':').map(Number);
    let wakeDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), wakeHour, wakeMin);
    
    // If wake time is in the future (e.g. night shift or wrong input), assume yesterday
    if (wakeDate > now) {
      wakeDate.setDate(wakeDate.getDate() - 1);
    }
    const hoursAwake = (now - wakeDate) / (1000 * 60 * 60);

    // Battery % Algorithm
    let battery = 100;
    
    // Sleep Penalty (Max 30% drop)
    const sleepPenalty = (100 - sleepScore) * 0.3;
    battery -= sleepPenalty;

    // Time Drain (Approx 40% drain over 16 hours)
    const timeDrain = Math.min(hoursAwake / 16, 1.5) * 40;
    battery -= timeDrain;

    // Exercise Drain
    const exerciseDrain = (exerciseCalories / tdee) * 100 * 0.5;
    battery -= exerciseDrain;

    // Food Recovery (Max +40%)
    if (caloriesConsumed > 0) {
      const foodBonus = Math.min(caloriesConsumed / tdee, 1.2) * 40;
      battery += foodBonus;
    }

    battery = Math.max(0, Math.min(100, Math.round(battery)));

    // Remaining Energy Est (TDEE - elapsed time approx - exercise + consumed)
    // Rough estimate just for gamification
    const remainingKcal = Math.max(0, Math.round((battery / 100) * totalExpenditure));

    // 3. Update UI
    statBmr.innerText = `${Math.round(bmr)} kcal`;
    statTdee.innerText = `${Math.round(tdee)} kcal`;
    statExercise.innerText = `${Math.round(exerciseCalories)} kcal`;
    statSleep.innerText = `${sleepScore}/100`;
    statRemaining.innerText = `${remainingKcal} kcal`;

    updateGauge(battery);
    saveToHistory(battery);

    // Transition Screens
    inputSection.classList.remove('active');
    inputSection.classList.add('hidden');
    setTimeout(() => {
      resultSection.classList.remove('hidden');
      resultSection.classList.add('active');
      renderChart();
    }, 300);
  }

  function updateGauge(percent) {
    batteryPercentEl.innerText = `${percent}%`;
    
    // Animate stroke
    const offset = GAUGE_CIRCUMFERENCE - (percent / 100) * GAUGE_CIRCUMFERENCE;
    // Set to 0 initially for animation if desired, but CSS transition handles it
    setTimeout(() => {
      gaugePath.style.strokeDashoffset = offset;
    }, 50);

    // Determine Color & Status
    let colorVar = '--status-red';
    let statusText = 'Recharge recommended';

    if (percent >= 80) {
      colorVar = '--status-green';
      statusText = 'High energy';
    } else if (percent >= 60) {
      colorVar = '--status-green';
      statusText = 'Good';
    } else if (percent >= 41) {
      colorVar = '--status-yellow';
      statusText = 'Moderate';
    } else if (percent >= 21) {
      colorVar = '--status-orange';
      statusText = 'Low energy';
    }

    // Apply color
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);
    const colorValue = computedStyle.getPropertyValue(colorVar).trim();
    
    gaugePath.style.stroke = colorValue;
    batteryPercentEl.style.color = colorValue;
    batteryStatusEl.innerText = statusText;
  }

  function saveToHistory(percent) {
    let history = JSON.parse(localStorage.getItem('batteryHistory')) || [];
    const today = new Date().toLocaleDateString(undefined, { weekday: 'short' });
    
    // If today exists, update it, else push new
    const lastEntry = history[history.length - 1];
    if (lastEntry && lastEntry.date === today) {
      lastEntry.percent = percent;
    } else {
      history.push({ date: today, percent: percent });
      if (history.length > 7) {
        history.shift(); // Keep only last 7
      }
    }
    
    localStorage.setItem('batteryHistory', JSON.stringify(history));
  }

  function renderChart() {
    trendChart.innerHTML = '';
    const history = JSON.parse(localStorage.getItem('batteryHistory')) || [];
    
    if (history.length === 0) {
      trendChart.innerHTML = '<span style="color:var(--text-secondary);font-size:0.8rem;">No data yet. Calculate to start tracking!</span>';
      return;
    }

    history.forEach(item => {
      let colorVar = 'var(--status-red)';
      if (item.percent >= 60) colorVar = 'var(--status-green)';
      else if (item.percent >= 41) colorVar = 'var(--status-yellow)';
      else if (item.percent >= 21) colorVar = 'var(--status-orange)';

      const barContainer = document.createElement('div');
      barContainer.className = 'chart-bar-container';

      const bar = document.createElement('div');
      bar.className = 'chart-bar';
      bar.style.backgroundColor = colorVar;
      // Animate height
      bar.style.height = '0%';
      setTimeout(() => {
        bar.style.height = `${item.percent}%`;
      }, 100);

      const label = document.createElement('div');
      label.className = 'chart-label';
      label.innerText = item.date;

      barContainer.appendChild(bar);
      barContainer.appendChild(label);
      trendChart.appendChild(barContainer);
    });
  }
});
