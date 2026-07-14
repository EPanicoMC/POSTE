// Modulo Report — reportistica mensile con raggruppamento settimanale
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

  function getISOWeek(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const yearStart = new Date(d.getFullYear(), 0, 4);
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
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

    const weeks = {};

    workDays.forEach(date => {
      const dateStr = Calendar.formatDate(date);
      const stamps = Storage.getDay(dateStr);
      const isPast = date <= today;
      const netMins = Storage.calcNetMinutes(stamps);
      const delta = netMins - Storage.TARGET_MINUTES;
      const weekNum = getISOWeek(date);

      const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

      const row = {
        date: dateStr,
        dayName: dayNames[date.getDay()],
        dayNum: date.getDate(),
        stamps,
        netMins,
        delta,
        isPast,
        hasData: stamps.length > 0,
        weekNum
      };

      if (stamps.length > 0) {
        totalMins += netMins;
        daysWorked++;
        totalDelta += delta;
        if (netMins >= Storage.TARGET_MINUTES) daysAbove++;
        else daysBelow++;
      }

      if (!weeks[weekNum]) {
        weeks[weekNum] = { totalMins: 0, daysWorked: 0, totalDelta: 0, daysInWeek: 0 };
      }
      weeks[weekNum].daysInWeek++;
      if (stamps.length > 0) {
        weeks[weekNum].totalMins += netMins;
        weeks[weekNum].daysWorked++;
        weeks[weekNum].totalDelta += delta;
      }

      rows.push(row);
    });

    const avgMins = daysWorked > 0 ? Math.round(totalMins / daysWorked) : 0;

    return {
      year: currentYear,
      month: currentMonth,
      monthName: Calendar.MONTH_NAMES[currentMonth],
      rows,
      weeks,
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
        <div class="summary-value">${data.daysAbove}<span style="font-size:0.8rem;color:var(--text-muted)">/${data.daysWorked}</span></div>
        <div class="summary-label">Giorni in Soglia</div>
      </div>
    `;

    // Tabella con raggruppamento settimanale
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

    let currentWeek = null;

    data.rows.forEach((row, idx) => {
      if (!row.hasData && !row.isPast) return;

      // Subtotale settimanale prima di iniziare una nuova settimana
      if (currentWeek !== null && row.weekNum !== currentWeek) {
        const weekData = data.weeks[currentWeek];
        if (weekData && weekData.daysWorked > 0) {
          const wDeltaSign = weekData.totalDelta >= 0 ? '+' : '';
          const wDeltaClass = weekData.totalDelta >= 0 ? 'positive' : 'negative';
          tableHtml += `
            <tr class="week-subtotal">
              <td>Sett. ${currentWeek}</td>
              <td>${weekData.daysWorked} giorni</td>
              <td>${Storage.formatMinutes(weekData.totalMins)}</td>
              <td class="${wDeltaClass}">${wDeltaSign}${Storage.formatMinutes(weekData.totalDelta)}</td>
            </tr>
          `;
        }
      }
      currentWeek = row.weekNum;

      const stampsStr = row.stamps.length > 0
        ? row.stamps.map(s => `${s.tipo === 'entrata' ? '→' : '←'} ${s.ora}`).join(' ')
        : '—';

      const netStr = row.hasData ? Storage.formatMinutes(row.netMins) : '—';
      const deltaStr = row.hasData
        ? `${row.delta >= 0 ? '+' : ''}${Storage.formatMinutes(row.delta)}`
        : '—';
      const rowDeltaClass = row.hasData ? (row.delta >= 0 ? 'positive' : 'negative') : '';

      tableHtml += `
        <tr>
          <td>${row.dayName.slice(0, 3)} ${row.dayNum}</td>
          <td style="font-size:0.68rem">${stampsStr}</td>
          <td>${netStr}</td>
          <td class="${rowDeltaClass}">${deltaStr}</td>
        </tr>
      `;
    });

    // Subtotale dell'ultima settimana
    if (currentWeek !== null && data.weeks[currentWeek] && data.weeks[currentWeek].daysWorked > 0) {
      const weekData = data.weeks[currentWeek];
      const wDeltaSign = weekData.totalDelta >= 0 ? '+' : '';
      const wDeltaClass = weekData.totalDelta >= 0 ? 'positive' : 'negative';
      tableHtml += `
        <tr class="week-subtotal">
          <td>Sett. ${currentWeek}</td>
          <td>${weekData.daysWorked} giorni</td>
          <td>${Storage.formatMinutes(weekData.totalMins)}</td>
          <td class="${wDeltaClass}">${wDeltaSign}${Storage.formatMinutes(weekData.totalDelta)}</td>
        </tr>
      `;
    }

    tableHtml += '</tbody>';
    tableEl.innerHTML = tableHtml;
  }

  function getCurrentMonth() {
    return { year: currentYear, month: currentMonth };
  }

  return { init, prevMonth, nextMonth, render, getMonthData, getCurrentMonth };
})();
