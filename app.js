
let DATA = [];
const statusEl = document.getElementById('status');
const metaEl = document.getElementById('meta');

// Theme
const themeToggle = document.getElementById('themeToggle');
function initTheme(){
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  themeToggle.textContent = saved === 'dark' ? '🌙' : '☀️';
}
themeToggle.onclick = () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  themeToggle.textContent = next === 'dark' ? '🌙' : '☀️';
};
initTheme();

statusEl.href = SHEET_VIEW_URL;

async function loadSheet() {
  statusEl.textContent = 'Loading...';
  try {
    const url = SHEET_CSV_URL + '&_=' + Date.now();
    const res = await fetch(url, {cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const csv = await res.text();
    const parsed = Papa.parse(csv, {header:true, skipEmptyLines:true});
    DATA = parsed.data.map(cleanRow).filter(r=>r.link);
    statusEl.textContent = `Live • ${DATA.length} docs`;
    buildFilters(); renderTable(); buildSuggestions();
    metaEl.textContent = `Last sync: ${new Date().toLocaleString()}`;
  } catch(e) {
    statusEl.textContent = 'Offline';
    DATA = sampleData(); buildFilters(); renderTable(); buildSuggestions();
  }
}

function cleanRow(r){
  const get = k => (r[k]||'').trim();
  const services = Array.from({length:21},(_,i)=>get('Service'+(i+1))).filter(Boolean);
  const dirMatch = services.join(' ').match(/Directorate\s*=\s*([A-Za-z]+)/);
  return {
    link: get('Website Document Link'),
    original: get('Original File Name'),
    newName: get('New File Name'),
    type: get('Type'),
    section: get('Section'),
    date: get('Date of Amendment'),
    desc: get('Description'),
    directorate: dirMatch ? dirMatch[1] : ''
  };
}

function buildFilters(){ /* same as before */ 
  const dirs = [...new Set(DATA.map(d=>d.directorate).filter(Boolean))].sort();
  const secs = [...new Set(DATA.map(d=>d.section).filter(Boolean))].sort();
  const types = [...new Set(DATA.map(d=>d.type).filter(Boolean))].sort();
  document.getElementById('directorate').innerHTML = '<option value="">All Directorates</option>' + dirs.map(d=>`<option>${d}</option>`).join('');
  document.getElementById('section').innerHTML = '<option value="">All Sections</option>' + secs.map(s=>`<option>${s}</option>`).join('');
  document.getElementById('type').innerHTML = '<option value="">All Types</option>' + types.map(t=>`<option>${t}</option>`).join('');
}
function renderTable(){ /* same */
  const q = document.getElementById('search').value.toLowerCase();
  const dir = document.getElementById('directorate').value;
  const sec = document.getElementById('section').value;
  const typ = document.getElementById('type').value;
  const tbody = document.querySelector('#tbl tbody');
  const filtered = DATA.filter(d=>{ const hay=`${d.original} ${d.newName} ${d.desc} ${d.section}`.toLowerCase(); return (!q||hay.includes(q)) && (!dir||d.directorate===dir) && (!sec||d.section===sec) && (!typ||d.type===typ);});
  tbody.innerHTML = filtered.map(d=>`<tr><td>${d.newName && !/no change/i.test(d.newName)?d.newName:d.original}</td><td>${d.type}</td><td>${d.section}</td><td>${d.date}</td><td>${d.desc}</td><td>${d.directorate}</td><td><a href="${d.link}" target="_blank">View</a></td></tr>`).join('');
  metaEl.textContent = `${filtered.length} of ${DATA.length} documents`;
}
function buildSuggestions(){ const qs=['What is CAR 21?','How to register aircraft?','CAR-M requirements?']; document.getElementById('suggest').innerHTML=qs.map(q=>`<button>${q}</button>`).join(''); document.querySelectorAll('#suggest button').forEach(b=>b.onclick=()=>ask(b.textContent));}
function findRelevantDocs(q,n=8){ const words=q.toLowerCase().split(/\W+/); return DATA.map(d=>({...d,score:words.reduce((s,w)=>s+(w.length>3&&(d.desc+d.section).toLowerCase().includes(w)?1:0),0)})).sort((a,b)=>b.score-a.score).slice(0,n);}

async function ask(text){
  const m=document.getElementById('messages');
  m.innerHTML+=`<div class="msg user">${text}</div>`;
  const thinking=document.createElement('div'); thinking.className='msg bot'; thinking.textContent='Thinking...'; m.appendChild(thinking); m.scrollTop=m.scrollHeight;
  try{
    const relevant=findRelevantDocs(text,8);
    const context=relevant.map((d,i)=>`${i+1}. ${d.desc} | Doc:${d.original} | Section:${d.section} | Date:${d.date} | Link:${d.link}`).join('\n');
    const prompt=`Answer using ONLY these DGCA documents. Cite name, section, date.\n\n${context}\n\nQuestion: ${text}`;
    const res=await fetch(WORKER_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:GROQ_MODEL,messages:[{role:'system',content:'You are DGCA expert'},{role:'user',content:prompt}],temperature:0.1})});
    const data=await res.json(); const answer=data.choices?.[0]?.message?.content||'No response';
    thinking.innerHTML=answer.replace(/\n/g,'<br>')+`<br><br><small>Sources: ${relevant.slice(0,3).map(d=>`<a href="${d.link}" target="_blank">${d.original}</a>`).join(', ')}</small>`;
  }catch(e){thinking.textContent='Error: '+e.message+' - check WORKER_URL in config.js';}
}

document.getElementById('send').onclick=()=>{const v=document.getElementById('chatInput').value.trim();if(v)ask(v)};
document.getElementById('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('send').click()});
['search','directorate','section','type'].forEach(id=>document.getElementById(id).addEventListener('input',renderTable));
document.getElementById('refresh').onclick=loadSheet;
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));t.classList.add('active');document.getElementById(t.dataset.tab).classList.add('active')});
function sampleData(){return []}
loadSheet(); setInterval(loadSheet, REFRESH_INTERVAL_MS);
