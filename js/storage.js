// Modulo Storage — localStorage + GitHub API sync
const Storage = (() => {
  const LOCAL_KEY = 'poste_timbrature';
  const CONFIG_KEY = 'poste_github_config';

  // Carica dati da localStorage
  function loadLocal() {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return { timbrature: {} };
    try {
      return JSON.parse(raw);
    } catch {
      return { timbrature: {} };
    }
  }

  // Salva dati in localStorage
  function saveLocal(data) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  }

  // Configurazione GitHub
  function getConfig() {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function saveConfig(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }

  function clearConfig() {
    localStorage.removeItem(CONFIG_KEY);
  }

  // GitHub API — leggi file
  async function githubRead(config) {
    const { owner, repo, pat } = config;
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/data/timbrature.json`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (res.status === 404) return { data: { timbrature: {} }, sha: null };
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const json = await res.json();
    const content = JSON.parse(atob(json.content));
    return { data: content, sha: json.sha };
  }

  // GitHub API — scrivi file
  async function githubWrite(config, data, sha) {
    const { owner, repo, pat } = config;
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/data/timbrature.json`;
    const body = {
      message: `Aggiornamento timbrature ${new Date().toISOString().slice(0, 10)}`,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
      branch: 'main'
    };
    if (sha) body.sha = sha;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub write error: ${res.status}`);
    }
    const result = await res.json();
    return result.content.sha;
  }

  // SHA corrente (per aggiornamenti)
  let currentSha = null;

  // Sync da GitHub → localStorage (merge)
  async function syncFromGitHub() {
    const config = getConfig();
    if (!config) return false;
    try {
      const { data, sha } = await githubRead(config);
      currentSha = sha;
      const local = loadLocal();
      // Merge: GitHub ha precedenza per i giorni presenti, locale aggiunge quelli mancanti
      const merged = { timbrature: { ...local.timbrature, ...data.timbrature } };
      saveLocal(merged);
      return true;
    } catch (e) {
      console.warn('Sync da GitHub fallita:', e.message);
      return false;
    }
  }

  // Sync localStorage → GitHub
  async function syncToGitHub() {
    const config = getConfig();
    if (!config) return false;
    try {
      const data = loadLocal();
      // Rileggi SHA prima di scrivere per evitare conflitti
      if (!currentSha) {
        const existing = await githubRead(config);
        currentSha = existing.sha;
      }
      currentSha = await githubWrite(config, data, currentSha);
      return true;
    } catch (e) {
      console.warn('Sync verso GitHub fallita:', e.message);
      return false;
    }
  }

  // Test connessione GitHub
  async function testConnection(config) {
    try {
      const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${config.pat}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const repo = await res.json();
      return { ok: true, repoName: repo.full_name };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // --- API pubbliche per timbrature ---

  function getDay(dateStr) {
    const data = loadLocal();
    return data.timbrature[dateStr] || [];
  }

  function getAllData() {
    return loadLocal();
  }

  function setDay(dateStr, stamps) {
    const data = loadLocal();
    if (stamps.length === 0) {
      delete data.timbrature[dateStr];
    } else {
      data.timbrature[dateStr] = stamps;
    }
    saveLocal(data);
    // Sync asincrono verso GitHub (non blocca)
    syncToGitHub().catch(() => {});
  }

  function addStamp(dateStr, tipo, ora) {
    const stamps = getDay(dateStr);
    stamps.push({ tipo, ora });
    stamps.sort((a, b) => a.ora.localeCompare(b.ora));
    setDay(dateStr, stamps);
    return stamps;
  }

  function removeStamp(dateStr, index) {
    const stamps = getDay(dateStr);
    stamps.splice(index, 1);
    setDay(dateStr, stamps);
    return stamps;
  }

  function updateStamp(dateStr, index, ora) {
    const stamps = getDay(dateStr);
    if (stamps[index]) {
      stamps[index].ora = ora;
      stamps.sort((a, b) => a.ora.localeCompare(b.ora));
    }
    setDay(dateStr, stamps);
    return stamps;
  }

  // Calcolo ore nette per un giorno
  function calcNetMinutes(stamps) {
    if (!stamps || stamps.length === 0) return 0;
    let total = 0;
    let i = 0;
    while (i < stamps.length - 1) {
      if (stamps[i].tipo === 'entrata' && stamps[i + 1].tipo === 'uscita') {
        const [hIn, mIn] = stamps[i].ora.split(':').map(Number);
        const [hOut, mOut] = stamps[i + 1].ora.split(':').map(Number);
        total += (hOut * 60 + mOut) - (hIn * 60 + mIn);
        i += 2;
      } else {
        i++;
      }
    }
    return total;
  }

  // Formatta minuti in "Xh Ym"
  function formatMinutes(mins) {
    const negative = mins < 0;
    const absMins = Math.abs(mins);
    const h = Math.floor(absMins / 60);
    const m = absMins % 60;
    const str = `${h}h ${m.toString().padStart(2, '0')}m`;
    return negative ? `-${str}` : str;
  }

  // Soglia giornaliera in minuti (7h 42m)
  const TARGET_MINUTES = 462;

  // Giorni lavorativi del mese (lun-ven)
  function getWorkingDays(year, month) {
    const days = [];
    const date = new Date(year, month, 1);
    while (date.getMonth() === month) {
      const dow = date.getDay();
      if (dow >= 1 && dow <= 5) {
        days.push(new Date(date));
      }
      date.setDate(date.getDate() + 1);
    }
    return days;
  }

  return {
    getDay,
    getAllData,
    setDay,
    addStamp,
    removeStamp,
    updateStamp,
    calcNetMinutes,
    formatMinutes,
    TARGET_MINUTES,
    getWorkingDays,
    getConfig,
    saveConfig,
    clearConfig,
    syncFromGitHub,
    syncToGitHub,
    testConnection,
    loadLocal
  };
})();
