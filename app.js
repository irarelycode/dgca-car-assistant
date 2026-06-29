
let DATA = [];
const statusEl = document.getElementById('status');
const metaEl = document.getElementById('meta');

async function loadSheet() {
  statusEl.textContent = 'Loading...';
  try {
    const url = SHEET_CSV_URL + (SHEET_CSV_URL.includes('?') ? '&' : '?') + '_=' + Date.now();
    const res = await fetch(url, {cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const csv = await res.text();
    const parsed = Papa.parse(csv, {header:true, skipEmptyLines:true});
    DATA = parsed.data.map(cleanRow).filter(r=>r.link);
    statusEl.textContent = `Live • ${DATA.length} docs`;
    statusEl.style.color = '#86efac';
    buildFilters();
    renderTable();
    buildSuggestions();
    metaEl.textContent = `Last sync: ${new Date().toLocaleString()} • Source: Google Sheets`;
  } catch(e) {
    statusEl.textContent = 'Offline – using sample';
    statusEl.style.color = '#fca5a5';
    console.error(e);
    // fallback sample
    DATA = sampleData();
    buildFilters(); renderTable(); buildSuggestions();
  }
}

function cleanRow(r){
  const get = k => (r[k]||'').trim();
  return {
    link: get('Website Document Link'),
    original: get('Original File Name'),
    newName: get('New File Name'),
    ocr: get('OCR Required'),
    type: get('Type'),
    section: get('Section'),
    date: get('Date of Amendment'),
    desc: get('Description'),
    services: Array.from({length:21},(_,i)=>get('Service'+(i+1))).filter(Boolean).join(' | '),
    directorate: (get('Service1').match(/Directorate\s*=\s*([^,]+)/)||[])[1] || ''
  };
}

function buildFilters(){
  const dirs = [...new Set(DATA.map(d=>d.directorate).filter(Boolean))].sort();
  const secs = [...new Set(DATA.map(d=>d.section).filter(Boolean))].sort();
  const types = [...new Set(DATA.map(d=>d.type).filter(Boolean))].sort();
  const dirSel = document.getElementById('directorate');
  const secSel = document.getElementById('section');
  const typSel = document.getElementById('type');
  dirSel.innerHTML = '<option value="">All Directorates</option>' + dirs.map(d=>`<option>${d}</option>`).join('');
  secSel.innerHTML = '<option value="">All Sections</option>' + secs.map(s=>`<option>${s}</option>`).join('');
  typSel.innerHTML = '<option value="">All Types</option>' + types.map(t=>`<option>${t}</option>`).join('');
}

function renderTable(){
  const q = document.getElementById('search').value.toLowerCase();
  const dir = document.getElementById('directorate').value;
  const sec = document.getElementById('section').value;
  const typ = document.getElementById('type').value;
  const tbody = document.querySelector('#tbl tbody');
  const filtered = DATA.filter(d=>{
    const hay = `${d.original} ${d.newName} ${d.desc} ${d.section}`.toLowerCase();
    return (!q||hay.includes(q)) && (!dir||d.directorate===dir) && (!sec||d.section===sec) && (!typ||d.type===typ);
  });
  tbody.innerHTML = filtered.map(d=>`
    <tr>
      <td>${d.newName!=='No Change'&&d.newName!=='NO CHANGE'?d.newName:d.original}</td>
      <td>${d.type}</td>
      <td>${d.section}</td>
      <td>${d.date}</td>
      <td>${d.desc}</td>
      <td>${d.directorate}</td>
      <td><a href="${d.link}" target="_blank">View</a></td>
    </tr>`).join('');
  metaEl.textContent = `${filtered.length} of ${DATA.length} documents • ${metaEl.textContent.split('•').slice(1).join('•')}`;
}

function buildSuggestions(){
  const qs = [
    'What is CAR 21 certification procedure?',
    'How to register aircraft in India?',
    'Requirements for Type Certificate acceptance',
    'What is CAR-M continued airworthiness?',
    'Special Flight Permit process'
  ];
  document.getElementById('suggest').innerHTML = qs.map(q=>`<button>${q}</button>`).join('');
  document.querySelectorAll('#suggest button').forEach(b=>b.onclick=()=>ask(b.textContent));
}

function ask(text){
  const m = document.getElementById('messages');
  m.innerHTML += `<div class="msg user">${text}</div>`;
  const hit = DATA.find(d=>text.toLowerCase().split(' ').some(w=>d.desc.toLowerCase().includes(w))) || DATA[0];
  const reply = `Based on your sheet: <b>${hit.desc}</b><br>• Document: ${hit.original}<br>• Section: ${hit.section}<br>• Amended: ${hit.date}<br>• Directorate: ${hit.directorate}<br><a href="${hit.link}" target="_blank">Open official PDF</a>`;
  setTimeout(()=>{m.innerHTML+=`<div class="msg bot">${reply}</div>`; m.scrollTop=m.scrollHeight;},400);
  document.getElementById('chatInput').value='';
}

document.getElementById('send').onclick = ()=>{ const v=document.getElementById('chatInput').value.trim(); if(v) ask(v); };
document.getElementById('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('send').click()});
['search','directorate','section','type'].forEach(id=>document.getElementById(id).addEventListener('input',renderTable));
document.getElementById('refresh').onclick=loadSheet;
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));t.classList.add('active');document.getElementById(t.dataset.tab).classList.add('active')});

function sampleData(){return [
{link:'#',original:'D6A-A2.pdf',newName:'',type:'CAR',section:'CAR, SECTION 6, SERIES A, PART 2',date:'20.01.2022',desc:'Requirements for recognition/ acceptance of Type Certificate',directorate:'AED'},
{link:'#',original:'CAR21.pdf',newName:'CAR21.pdf',type:'CAR',section:'CAR, SECTION 6, SERIES B, CAR 21',date:'18.07.2025',desc:'Certification Procedures for Aircraft and related products',directorate:'AED'}
];}

loadSheet();
setInterval(loadSheet, REFRESH_INTERVAL_MS);
document.getElementById('cfgPreview').textContent = `SHEET_CSV_URL = "${SHEET_CSV_URL}"`;
