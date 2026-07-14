// Modulo App — router SPA, inizializzazione, gestione stato
const App = (() => {
  let toastTimer = null;

  // Formatta data come YYYY-MM-DD
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Navigazione tra le viste
  function navigate(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const view = document.getElementById(`view-${viewName}`);
    const nav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    if (view) view.classList.add('active');
    if (nav) nav.classList.add('active');

    // Aggiorna la vista quando la si apre
    if (viewName === 'oggi') renderToday();
    if (viewName === 'calendario') Calendar.render();
    if (viewName === 'report') Report.render();
    if (viewName === 'impostazioni') loadSettings();
  }

  // Toast (notifica)
  function showToast(msg, type) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type || ''} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // Aggiorna orologio corrente
  function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const el1 = document.getElementById('current-time');
    const el2 = document.getElementById('current-time-2');
    if (el1) el1.textContent = timeStr;
    if (el2) el2.textContent = timeStr;
  }

  // Render vista "Oggi"
  function renderToday() {
    const now = new Date();
    const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

    document.getElementById('today-day-name').textContent = dayNames[now.getDay()];
    document.getElementById('today-date').textContent =
      `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

    const dateStr = todayStr();
    const stamps = Storage.getDay(dateStr);
    const netMins = Storage.calcNetMinutes(stamps);

    // Ore e progresso
    document.getElementById('today-hours').textContent = Storage.formatMinutes(netMins);

    const pct = Math.min(100, Math.round((netMins / Storage.TARGET_MINUTES) * 100));
    const bar = document.getElementById('today-progress');
    bar.style.width = `${pct}%`;
    bar.className = 'progress-bar';
    if (pct >= 100) bar.classList.add('green');
    else if (pct >= 78) bar.classList.add('orange');
    else bar.classList.add('red');

    // Delta
    const delta = netMins - Storage.TARGET_MINUTES;
    const deltaEl = document.getElementById('today-delta');
    if (stamps.length > 0) {
      const sign = delta >= 0 ? '+' : '';
      deltaEl.textContent = `${sign}${Storage.formatMinutes(delta)}`;
      deltaEl.className = `progress-delta ${delta >= 0 ? 'positive' : 'negative'}`;
    } else {
      deltaEl.textContent = '';
    }

    // Animazione ore
    const hoursEl = document.getElementById('today-hours');
    hoursEl.classList.add('animated');
    setTimeout(() => hoursEl.classList.remove('animated'), 600);

    // Lista timbrature
    const list = document.getElementById('today-stamps-list');
    if (stamps.length === 0) {
      list.innerHTML = `
        <li class="empty-state">
          <div class="empty-icon">&#128339;</div>
          <p>Nessuna timbratura registrata</p>
        </li>`;
    } else {
      list.innerHTML = stamps.map((s, i) => `
        <li class="stamp-item">
          <span class="stamp-dot ${s.tipo}"></span>
          <div class="stamp-info">
            <div class="stamp-tipo">${s.tipo}</div>
            <div class="stamp-ora">${s.ora}</div>
          </div>
          <div class="stamp-actions">
            <button class="btn-icon" onclick="App.editStampToday(${i})" title="Modifica">&#9998;</button>
            <button class="btn-icon delete" onclick="App.deleteStampToday(${i})" title="Elimina">&#10005;</button>
          </div>
        </li>
      `).join('');
    }

    renderWeekSummary();
    renderStats();
    updateSyncStatus();
  }

  // Riepilogo settimanale
  function renderWeekSummary() {
    const weekData = Storage.getWeekSummary(new Date());
    const todayDate = todayStr();
    const dayLabels = ['L', 'M', 'M', 'G', 'V'];

    // Barra settimanale con indicatore giorno corrente
    const barEl = document.getElementById('week-bar');
    barEl.innerHTML = weekData.days.map((date, i) => {
      const dateStr = Storage.formatDateISO(date);
      const stamps = Storage.getDay(dateStr);
      const net = Storage.calcNetMinutes(stamps);
      const isToday = dateStr === todayDate;
      let cls = '';
      if (stamps.length > 0) {
        if (net >= Storage.TARGET_MINUTES) cls = 'green';
        else if (net >= 360) cls = 'orange';
        else cls = 'red';
      }
      return `<div class="week-bar-day ${cls}${isToday ? ' active' : ''}" title="${dayLabels[i]}: ${stamps.length > 0 ? Storage.formatMinutes(net) : '—'}"></div>`;
    }).join('');

    // Statistiche settimanali
    const statsEl = document.getElementById('week-stats');
    const weekDelta = weekData.totalMins - Storage.WEEKLY_TARGET_MINUTES;
    const weekDeltaForDisplay = weekData.totalMins - (weekData.daysPast * Storage.TARGET_MINUTES);
    const deltaSign = weekDeltaForDisplay >= 0 ? '+' : '';
    const deltaClass = weekDeltaForDisplay >= 0 ? 'positive' : 'negative';

    statsEl.innerHTML = `
      <div class="week-stat">
        <div class="week-stat-value">${Storage.formatMinutes(weekData.totalMins)}</div>
        <div class="week-stat-label">Ore Fatte</div>
      </div>
      <div class="week-stat">
        <div class="week-stat-value">${Storage.formatMinutes(Storage.WEEKLY_TARGET_MINUTES)}</div>
        <div class="week-stat-label">Obiettivo Sett.</div>
      </div>
      <div class="week-stat delta">
        <div class="week-stat-value ${deltaClass}">${deltaSign}${Storage.formatMinutes(weekDeltaForDisplay)}</div>
        <div class="week-stat-label">Delta</div>
      </div>
    `;
  }

  // Streak e compliance
  function renderStats() {
    const streak = Storage.calcStreak();
    const now = new Date();
    const compliance = Storage.getMonthCompliance(now.getFullYear(), now.getMonth());

    document.getElementById('streak-value').textContent = streak;
    document.getElementById('compliance-value').textContent = `${compliance.pct}%`;
  }

  // Timbratura rapida
  function stamp(tipo) {
    const now = new Date();
    const ora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    Storage.addStamp(todayStr(), tipo, ora);
    renderToday();
    showToast(`${tipo === 'entrata' ? 'Entrata' : 'Uscita'} registrata: ${ora}`, 'success');

    // Animazione pulsante
    const btn = document.querySelector(`.btn-stamp.${tipo}`);
    if (btn) {
      btn.classList.add('stamp-animation');
      setTimeout(() => btn.classList.remove('stamp-animation'), 300);
    }
  }

  // Elimina timbratura oggi
  function deleteStampToday(index) {
    Storage.removeStamp(todayStr(), index);
    renderToday();
    showToast('Timbratura eliminata', '');
  }

  // Modifica timbratura oggi
  function editStampToday(index) {
    const stamps = Storage.getDay(todayStr());
    const s = stamps[index];
    if (!s) return;

    const newOra = prompt(`Modifica orario (formato HH:MM):`, s.ora);
    if (newOra && /^\d{2}:\d{2}$/.test(newOra)) {
      Storage.updateStamp(todayStr(), index, newOra);
      renderToday();
      showToast('Timbratura aggiornata', 'success');
    } else if (newOra !== null) {
      showToast('Formato non valido (HH:MM)', 'error');
    }
  }

  // Apri dettaglio giorno (da calendario)
  function openDayDetail(dateStr) {
    const modal = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    const date = new Date(dateStr + 'T00:00:00');
    const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

    function renderDetail() {
      const stamps = Storage.getDay(dateStr);
      const netMins = Storage.calcNetMinutes(stamps);
      const delta = netMins - Storage.TARGET_MINUTES;

      let stampsHtml = '';
      if (stamps.length === 0) {
        stampsHtml = '<p style="text-align:center;color:var(--text-light);padding:16px;">Nessuna timbratura</p>';
      } else {
        stampsHtml = '<ul class="stamps-list">' + stamps.map((s, i) => `
          <li class="stamp-item">
            <span class="stamp-dot ${s.tipo}"></span>
            <div class="stamp-info">
              <div class="stamp-tipo">${s.tipo}</div>
              <div class="stamp-ora">${s.ora}</div>
            </div>
            <div class="stamp-actions">
              <button class="btn-icon" onclick="App.editStampDetail('${dateStr}', ${i})" title="Modifica">&#9998;</button>
              <button class="btn-icon delete" onclick="App.deleteStampDetail('${dateStr}', ${i})" title="Elimina">&#10005;</button>
            </div>
          </li>
        `).join('') + '</ul>';
      }

      const hoursInfo = stamps.length > 0
        ? `${Storage.formatMinutes(netMins)} (${delta >= 0 ? '+' : ''}${Storage.formatMinutes(delta)})`
        : 'Nessun dato';

      content.innerHTML = `
        <div class="day-detail-header">
          <div class="detail-date">${dayNames[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}</div>
          <div class="detail-hours">${hoursInfo}</div>
        </div>
        ${stampsHtml}
        <div class="add-stamp-row">
          <select id="add-stamp-tipo">
            <option value="entrata">Entrata</option>
            <option value="uscita">Uscita</option>
          </select>
          <input type="time" id="add-stamp-ora" value="${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}">
          <button class="btn-add" onclick="App.addStampDetail('${dateStr}')">+</button>
        </div>
      `;
    }

    // Salva funzione render per aggiornamenti successivi
    window._currentDetailRender = renderDetail;
    window._currentDetailDate = dateStr;

    renderDetail();
    modal.classList.add('show');
  }

  function addStampDetail(dateStr) {
    const tipo = document.getElementById('add-stamp-tipo').value;
    const ora = document.getElementById('add-stamp-ora').value;
    if (!ora) return;
    Storage.addStamp(dateStr, tipo, ora);
    if (window._currentDetailRender) window._currentDetailRender();
    Calendar.render();
    if (dateStr === todayStr()) renderToday();
    showToast(`${tipo === 'entrata' ? 'Entrata' : 'Uscita'} aggiunta: ${ora}`, 'success');
  }

  function editStampDetail(dateStr, index) {
    const stamps = Storage.getDay(dateStr);
    const s = stamps[index];
    if (!s) return;
    const newOra = prompt(`Modifica orario (formato HH:MM):`, s.ora);
    if (newOra && /^\d{2}:\d{2}$/.test(newOra)) {
      Storage.updateStamp(dateStr, index, newOra);
      if (window._currentDetailRender) window._currentDetailRender();
      Calendar.render();
      if (dateStr === todayStr()) renderToday();
      showToast('Timbratura aggiornata', 'success');
    } else if (newOra !== null) {
      showToast('Formato non valido (HH:MM)', 'error');
    }
  }

  function deleteStampDetail(dateStr, index) {
    Storage.removeStamp(dateStr, index);
    if (window._currentDetailRender) window._currentDetailRender();
    Calendar.render();
    if (dateStr === todayStr()) renderToday();
    showToast('Timbratura eliminata', '');
  }

  // Chiudi modal
  function closeModal(event) {
    if (event.target === document.getElementById('modal-overlay')) {
      document.getElementById('modal-overlay').classList.remove('show');
    }
  }

  // Stato sync
  function updateSyncStatus() {
    const config = Storage.getConfig();
    const dot = document.getElementById('sync-dot');
    const text = document.getElementById('sync-text');
    if (config) {
      dot.className = 'sync-dot online';
      text.textContent = `Sincronizzato con ${config.owner}/${config.repo}`;
    } else {
      dot.className = 'sync-dot';
      text.textContent = 'Solo locale';
    }
  }

  // Impostazioni GitHub
  function loadSettings() {
    const config = Storage.getConfig();
    if (config) {
      document.getElementById('cfg-owner').value = config.owner || '';
      document.getElementById('cfg-repo').value = config.repo || '';
      document.getElementById('cfg-pat').value = config.pat || '';
    }
  }

  async function testGitHub() {
    const config = {
      owner: document.getElementById('cfg-owner').value.trim(),
      repo: document.getElementById('cfg-repo').value.trim(),
      pat: document.getElementById('cfg-pat').value.trim()
    };
    if (!config.owner || !config.repo || !config.pat) {
      showToast('Compila tutti i campi', 'error');
      return;
    }
    const btn = document.getElementById('btn-test-gh');
    btn.textContent = 'Connessione in corso...';
    btn.disabled = true;
    const result = await Storage.testConnection(config);
    btn.textContent = 'Testa Connessione';
    btn.disabled = false;
    if (result.ok) {
      showToast(`Connesso a ${result.repoName}`, 'success');
    } else {
      showToast(`Errore: ${result.error}`, 'error');
    }
  }

  function saveGitHub() {
    const config = {
      owner: document.getElementById('cfg-owner').value.trim(),
      repo: document.getElementById('cfg-repo').value.trim(),
      pat: document.getElementById('cfg-pat').value.trim()
    };
    if (!config.owner || !config.repo || !config.pat) {
      showToast('Compila tutti i campi', 'error');
      return;
    }
    Storage.saveConfig(config);
    showToast('Configurazione salvata', 'success');
    updateSyncStatus();
  }

  async function syncNow() {
    showToast('Sincronizzazione in corso...', '');
    const ok = await Storage.syncFromGitHub();
    if (ok) {
      const ok2 = await Storage.syncToGitHub();
      showToast(ok2 ? 'Sincronizzazione completata' : 'Sync parziale (upload fallito)', ok2 ? 'success' : 'error');
    } else {
      showToast('Sincronizzazione fallita', 'error');
    }
    renderToday();
    Calendar.render();
    Report.render();
  }

  // Export/Import dati
  function exportAllData() {
    const data = Storage.getAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timbrature_backup_${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup esportato', 'success');
  }

  function importDataPrompt() {
    document.getElementById('import-file').click();
  }

  function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.timbrature) {
          const current = Storage.getAllData();
          const merged = { timbrature: { ...current.timbrature, ...data.timbrature } };
          Object.keys(merged.timbrature).forEach(dateStr => {
            Storage.setDay(dateStr, merged.timbrature[dateStr]);
          });
          renderToday();
          Calendar.render();
          Report.render();
          showToast('Dati importati', 'success');
        } else {
          showToast('File non valido', 'error');
        }
      } catch {
        showToast('Errore nel parsing del file', 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  // Inizializzazione
  async function init() {
    updateClock();
    setInterval(updateClock, 30000);

    renderToday();
    Calendar.init();
    Report.init();
    loadSettings();

    // Sync iniziale da GitHub
    const config = Storage.getConfig();
    if (config) {
      updateSyncStatus();
      await Storage.syncFromGitHub();
      renderToday();
    }

    // Registra Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  // Avvio
  document.addEventListener('DOMContentLoaded', init);

  return {
    navigate,
    stamp,
    deleteStampToday,
    editStampToday,
    openDayDetail,
    addStampDetail,
    editStampDetail,
    deleteStampDetail,
    closeModal,
    testGitHub,
    saveGitHub,
    syncNow,
    exportAllData,
    importDataPrompt,
    importData,
    showToast,
    renderToday
  };
})();
