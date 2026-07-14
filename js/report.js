// Modulo Report — reportistica mensile e giornaliera
const Report = (() => {
  let currentYear, currentMonth;

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

  function getMonthData() {
    const workDays = Storage.getWorkingDays(currentYear, currentMonth);
    const today = new Date();
    const rows = [];
    let totalMins = 0;
    let daysWorked = 0;
    let daysAbove = 0;
    let daysBelow = 0;
    let totalDelta = 0;

    workDays.forEach(date => {
      const dateStr = Calendar.formatDate(date);
      const stamps = Storage.getDay(dateStr);
      const isPast = date <= today;
      const netMins = Storage.calcNetMinutes(stamps);
      const delta = netMins - Storage.TARGET_MINUTES;

      const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

      const row = {
        date: dateStr,
        dayName: dayNames[date.getDay()],
        dayNum: date.getDate(),
        stamps,
        netMins,
        delta,
        isPast,
        hasData: stamps.length > 0
      };

      if (stamps.length > 0) {
        totalMins += netMins;
        daysWorked++;
        totalDelta += delta;
        if (netMins >= Storage.TARGET_MINUTES) daysAbove++;
        else daysBelow++;
      }

      rows.push(row);
    });

    const avgMins = daysWorked > 0 ? Math.round(totalMins / daysWorked) : 0;

    return {
      year: currentYear,
      month: currentMonth,
      monthName: Calendar.MONTH_NAMES[currentMonth],
      rows,
      totalMins,
      daysWorked,
      daysAbove,
      daysBelow,
      totalDelta,
      avgMins,
      totalWorkDays: workDays.length
    };
  }

  function render() {
    const nameEl = document.getElementById('report-month-name');
    const summaryEl = document.getElementById('report-summary');
    const tableEl = document.getElementById('report-table');
    if (!nameEl || !summaryEl || !tableEl) return;

    const data = getMonthData();
    nameEl.textContent = `${data.monthName} ${data.year}`;

    // Sommario
    const deltaClass = data.totalDelta >= 0 ? 'positive' : 'negative';
    summaryEl.innerHTML = `
      <div class="summary-item">
        <div class="summary-value">${Storage.formatMinutes(data.totalMins)}</div>
        <div class="summary-label">Ore Totali</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${Storage.formatMinutes(data.avgMins)}</div>
        <div class="summary-label">Media Giornaliera</div>
      </div>
      <div class="summary-item ${deltaClass}">
        <div class="summary-value">${data.totalDelta >= 0 ? '+' : ''}${Storage.formatMinutes(data.totalDelta)}</div>
        <div class="summary-label">Delta Totale</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${data.daysAbove}<span style="font-size:0.8rem;color:var(--text-light)">/${data.daysWorked}</span></div>
        <div class="summary-label">Giorni in Soglia</div>
      </div>
    `;

    // Tabella
    let tableHtml = `
      <thead>
        <tr>
          <th>Giorno</th>
          <th>Timbrature</th>
          <th>Netto</th>
          <th>Delta</th>
        </tr>
      </thead>
      <tbody>
    `;

    data.rows.forEach(row => {
      if (!row.hasData && !row.isPast) return;

      const stampsStr = row.stamps.length > 0
        ? row.stamps.map(s => `${s.tipo === 'entrata' ? '→' : '←'} ${s.ora}`).join(' ')
        : '—';

      const netStr = row.hasData ? Storage.formatMinutes(row.netMins) : '—';
      const deltaStr = row.hasData
        ? `${row.delta >= 0 ? '+' : ''}${Storage.formatMinutes(row.delta)}`
        : '—';
      const deltaClass = row.hasData ? (row.delta >= 0 ? 'positive' : 'negative') : '';

      tableHtml += `
        <tr>
          <td>${row.dayName.slice(0, 3)} ${row.dayNum}</td>
          <td style="font-size:0.7rem">${stampsStr}</td>
          <td>${netStr}</td>
          <td class="${deltaClass}">${deltaStr}</td>
        </tr>
      `;
    });

    tableHtml += '</tbody>';
    tableEl.innerHTML = tableHtml;
  }

  function getCurrentMonth() {
    return { year: currentYear, month: currentMonth };
  }

  return { init, prevMonth, nextMonth, render, getMonthData, getCurrentMonth };
})();
