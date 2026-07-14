// Modulo Calendario — vista mensile Lun-Ven
const Calendar = (() => {
  let currentYear, currentMonth;

  const MONTH_NAMES = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven'];

  function init() {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
    render();
  }

  function prevMonth() {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    render();
  }

  function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    render();
  }

  function render() {
    const nameEl = document.getElementById('cal-month-name');
    const gridEl = document.getElementById('calendar-grid');
    if (!nameEl || !gridEl) return;

    nameEl.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

    const today = new Date();
    const todayStr = formatDate(today);

    // Header giorni della settimana
    let html = DAY_NAMES.map(d => `<div class="calendar-header">${d}</div>`).join('');

    // Giorni lavorativi del mese
    const workDays = Storage.getWorkingDays(currentYear, currentMonth);

    if (workDays.length === 0) {
      gridEl.innerHTML = html;
      return;
    }

    // Calcola offset per prima settimana
    const firstDay = workDays[0];
    const firstDow = (firstDay.getDay() + 6) % 7; // 0=Lun
    for (let i = 0; i < firstDow; i++) {
      html += '<div class="calendar-day empty"></div>';
    }

    let lastWeekProcessed = -1;

    workDays.forEach(date => {
      const dateStr = formatDate(date);
      const dow = (date.getDay() + 6) % 7; // 0=Lun, 4=Ven
      const weekNum = getWeekOfMonth(date);

      // Inserisci celle vuote per weekend (gap tra venerdì e lunedì)
      if (lastWeekProcessed !== -1 && weekNum > lastWeekProcessed && dow > 0) {
        for (let i = 0; i < dow; i++) {
          html += '<div class="calendar-day empty"></div>';
        }
      }

      lastWeekProcessed = weekNum;

      const stamps = Storage.getDay(dateStr);
      const netMins = Storage.calcNetMinutes(stamps);
      const isToday = dateStr === todayStr;
      const isFuture = date > today && !isToday;

      let statusClass = 'no-data';
      let hoursText = '—';

      let deltaHtml = '';

      if (stamps.length > 0) {
        hoursText = Storage.formatMinutes(netMins);
        const delta = netMins - Storage.TARGET_MINUTES;
        const deltaSign = delta >= 0 ? '+' : '';
        const deltaClass = delta >= 0 ? 'positive' : 'negative';
        deltaHtml = `<span class="day-delta ${deltaClass}">${deltaSign}${Storage.formatMinutes(delta)}</span>`;

        if (netMins >= Storage.TARGET_MINUTES) {
          statusClass = 'green';
        } else if (netMins >= 360) {
          statusClass = 'orange';
        } else {
          statusClass = 'red';
        }
      } else if (isFuture) {
        statusClass = 'future';
      }

      const todayClass = isToday ? ' today' : '';

      html += `
        <button class="calendar-day ${statusClass}${todayClass}" onclick="App.openDayDetail('${dateStr}')">
          <span class="day-num">${date.getDate()}</span>
          <span class="day-hours">${hoursText}</span>
          ${deltaHtml}
        </button>
      `;
    });

    gridEl.innerHTML = html;
  }

  function getWeekOfMonth(date) {
    const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    return Math.floor((date.getDate() + (firstOfMonth.getDay() + 5) % 7) / 7);
  }

  function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getCurrentMonth() {
    return { year: currentYear, month: currentMonth };
  }

  return { init, prevMonth, nextMonth, render, formatDate, getCurrentMonth, MONTH_NAMES };
})();
