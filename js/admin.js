import { getAccessLogs, exportLogsAsCsv, exportLogsAsJson } from './storage.js';

const $ = sel => document.querySelector(sel);

function setYear(){ const y=$('#year'); if(y) y.textContent = new Date().getFullYear(); }

function renderTable(rows){
  const tbody = $('#logsTable tbody');
  tbody.innerHTML = '';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.name||''}</td>
      <td>${r.email||''}</td>
      <td>${r.phone||''}</td>
      <td>${new Date(r.accessedAt).toLocaleString()}</td>
      <td>${r.content||''}</td>
      <td>${r.ip||''}</td>
    `;
    tbody.appendChild(tr);
  });
}

function unique(arr, keyFn){
  const seen = new Set();
  return arr.filter(x => { const k = keyFn(x); if(seen.has(k)) return false; seen.add(k); return true; });
}

function statsAndChart(rows){
  // Stats
  $('#totalUsers').textContent = rows.length;
  const uniq = unique(rows, r => (r.email||'') + '|' + (r.phone||''));
  $('#uniqueUsers').textContent = uniq.length;

  const todayStr = new Date().toISOString().slice(0,10);
  const todayCount = rows.filter(r => (r.accessedAt||'').startsWith(todayStr)).length;
  $('#accessToday').textContent = todayCount;

  // Group by date
  const map = {};
  rows.forEach(r => {
    const d = (r.accessedAt||'').slice(0,10);
    if(!d) return;
    map[d] = (map[d]||0)+1;
  });
  const labels = Object.keys(map).sort();
  const data = labels.map(k => map[k]);

  // Chart
  const ctx = document.getElementById('byDateChart');
  if(!ctx || !window.Chart) return;
  new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Accesses', data }] },
    options: { responsive: true, plugins: { legend: { display: true } }, scales: { y: { beginAtZero: true } } }
  });
}

function init(){
  setYear();
  const all = getAccessLogs();
  renderTable(all);
  statsAndChart(all);

  $('#search').addEventListener('input', (e)=>{
    const q = e.target.value.toLowerCase();
    const filtered = all.filter(r => JSON.stringify(r).toLowerCase().includes(q));
    renderTable(filtered);
  });

  $('#exportCsv').addEventListener('click', ()=>{
    const url = exportLogsAsCsv();
    const a = document.createElement('a'); a.href = url; a.download = 'access_logs.csv'; a.click(); URL.revokeObjectURL(url);
  });
  $('#exportJson').addEventListener('click', ()=>{
    const url = exportLogsAsJson();
    const a = document.createElement('a'); a.href = url; a.download = 'access_logs.json'; a.click(); URL.revokeObjectURL(url);
  });
}
document.addEventListener('DOMContentLoaded', init);
