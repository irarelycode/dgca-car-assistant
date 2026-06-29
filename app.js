
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
    statusEl.style.color = '';
    buildFilters();
    renderTable();
    buildSuggestions();
    metaEl.textContent = `Last sync: ${new Date().toLocaleString()} • Source: Google Sheets`;
  } catch(e) {
    statusEl.textContent = 'Offline – using sample';
    console.error(e);
    DATA = sampleData();
    buildFilters(); renderTable(); buildSuggestions();
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
    ocr: get('OCR Required'),
    type: get('Type'),
    section: get('Section'),
    date: get('Date of Amendment'),
    desc: get('Description'),
    services,
    directorate: dirMatch ? dirMatch[1] : ''
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
      <td>${d.newName && !/no change/i.test(d.newName) ? d.newName : d.original}</td>
      <td>${d.type}</td>
      <td>${d.section}</td>
      <td>${d.date}</td>
      <td>${d.desc}</td>
      <td>${d.directorate}</td>
      <td><a href="${d.link}" target="_blank">View</a></td>
    </tr>`).join('');
  metaEl.textContent = `${filtered.length} of ${DATA.length} documents • Last sync: ${new Date().toLocaleTimeString()}`;
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

function findRelevantDocs(question, n=8){
  const q = question.toLowerCase().split(/\W+/);
  return DATA.map(d=>{
    const text = (d.desc + ' ' + d.section + ' ' + d.original).toLowerCase();
    const score = q.reduce((s,w)=>s + (w.length>3 && text.includes(w) ? 1:0), 0);
    return {...d, score};
  }).sort((a,b)=>b.score-a.score).slice(0,n);
}

async function ask(text){
  const m = document.getElementById('messages');
  m.innerHTML += `<div class="msg user">${text}</div>`;
  m.scrollTop = m.scrollHeight;
  
  const thinking = document.createElement('div');
  thinking.className = 'msg bot';
  thinking.textContent = 'Thinking with Groq...';
  m.appendChild(thinking);
  
  try {
    const relevant = findRelevantDocs(text, 8);
    const context = relevant.map((d,i)=>`${i+1}. ${d.desc} | Doc: ${d.original} | Section: ${d.section} | Date: ${d.date} | Directorate: ${d.directorate} | Link: ${d.link}`).join('\n');
    
    const prompt = `You are DGCA CAR Assistant for India. Answer the question using ONLY the documents below from the user's Google Sheet. Always cite document name, section, and amendment date. If not in context, say "Not found in current mapping sheet."

CONTEXT DOCUMENTS:
${context}

QUESTION: ${text}

Provide a concise, accurate answer with bullet points and citations.`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + GROQ_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {role: 'system', content: 'You are an expert assistant for DGCA India regulations. Use only provided context.'},
          {role: 'user', content: prompt}
        ],
        temperature: 0.1,
        max_tokens: 800
      })
    });
    
    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content || 'No response from Groq';
    thinking.innerHTML = answer.replace(/\n/g,'<br>') + '<br><br><small>Sources: ' + relevant.slice(0,3).map(d=>`<a href="${d.link}" target="_blank">${d.original}</a>`).join(', ') + '</small>';
  } catch(e){
    thinking.textContent = 'Error calling Groq: ' + e.message + '. Check API key and network.';
  }
  m.scrollTop = m.scrollHeight;
  document.getElementById('chatInput').value='';
}

document.getElementById('send').onclick = ()=>{ const v=document.getElementById('chatInput').value.trim(); if(v) ask(v); };
document.getElementById('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('send').click()});
['search','directorate','section','type'].forEach(id=>document.getElementById(id).addEventListener('input',renderTable));
document.getElementById('refresh').onclick=loadSheet;
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));t.classList.add('active');document.getElementById(t.dataset.tab).classList.add('active')});

function sampleData(){return [
{link:'#',original:'D6A-A2.pdf',newName:'',type:'CAR',section:'CAR, SECTION 6',date:'20.01.2022',desc:'Requirements for recognition of Type Certificate',directorate:'AED'},
{link:'#',original:'CAR21.pdf',newName:'CAR21.pdf',type:'CAR',section:'CAR 21',date:'18.07.2025',desc:'Certification Procedures for Aircraft',directorate:'AED'}
];}

loadSheet();
setInterval(loadSheet, REFRESH_INTERVAL_MS);


// --- MANAGE TAB ---
const form = document.getElementById('docForm');
const checkBtn = document.getElementById('checkBtn');
const formStatus = document.getElementById('formStatus');
const dupCard = document.getElementById('duplicateCard');

function findByLink(link){
  return DATA.find(d => d.link && d.link.trim() === link.trim());
}

checkBtn.onclick = () => {
  const link = form.link.value.trim();
  if(!link){ formStatus.textContent='Enter link first'; return; }
  const existing = findByLink(link);
  if(existing){
    dupCard.classList.remove('hidden');
    dupCard.innerHTML = `<h3>⚠️ Already exists</h3>
      <p><strong>${existing.original}</strong><br>${existing.section} • ${existing.date}</p>
      <p>${existing.desc}</p>
      <div class="actions">
        <button onclick="fillFormFromExisting('${encodeURIComponent(link)}')">Load to Edit</button>
        <button onclick="deleteDoc('${encodeURIComponent(link)}')" class="secondary">Delete from Sheet</button>
      </div>`;
    formStatus.textContent = 'Duplicate found';
  } else {
    dupCard.classList.add('hidden');
    formStatus.textContent = 'No duplicate - safe to add';
  }
};

function fillFormFromExisting(encLink){
  const link = decodeURIComponent(encLink);
  const d = findByLink(link);
  if(!d) return;
  form.link.value = d.link;
  form.original.value = d.original;
  form.newName.value = d.newName || '';
  form.ocr.value = d.ocr || '';
  form.type.value = d.type || '';
  form.section.value = d.section || '';
  form.date.value = d.date || '';
  form.desc.value = d.desc || '';
  form.service1.value = d.services?.[0] || '';
  document.querySelector('[data-tab="manage"]').click();
}

async function deleteDoc(encLink){
  if(!confirm('Delete this document from sheet?')) return;
  const link = decodeURIComponent(encLink);
  formStatus.textContent = 'Deleting...';
  try{
    const res = await fetch(APPS_SCRIPT_URL, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'delete', link})});
    const out = await res.json();
    formStatus.textContent = out.message;
    setTimeout(()=>loadSheet(), 1500);
  }catch(e){ formStatus.textContent = 'Error: '+e.message; }
}

form.onsubmit = async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  const existing = findByLink(data.link);
  data.action = existing ? 'update' : 'create';
  formStatus.textContent = 'Saving...';
  try{
    const res = await fetch(APPS_SCRIPT_URL, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
    const out = await res.json();
    formStatus.textContent = out.message || 'Saved';
    if(out.success){ form.reset(); dupCard.classList.add('hidden'); setTimeout(()=>loadSheet(), 1500); }
  }catch(e){ formStatus.textContent = 'Error: '+e.message + ' - deploy Apps Script first'; }
};

// Add edit buttons in table
const origRender = renderTable;
renderTable = function(){
  origRender();
  document.querySelectorAll('#tbl tbody tr').forEach((tr,i)=>{
    const d = DATA.filter(...)[i]; // simplified - we'll add button via innerHTML in original
  });
};
// Patch table to include actions
const _oldRender = window.renderTable;
window.renderTable = function(){
  const q = document.getElementById('search').value.toLowerCase();
  const dir = document.getElementById('directorate').value;
  const sec = document.getElementById('section').value;
  const tbody = document.querySelector('#tbl tbody');
  const filtered = DATA.filter(d=>{ const hay=`${d.original} ${d.newName} ${d.desc} ${d.section}`.toLowerCase(); return (!q||hay.includes(q)) && (!dir||d.directorate===dir) && (!sec||d.section===sec);});
  tbody.innerHTML = filtered.map(d=>`<tr>
    <td>${d.newName && !/no change/i.test(d.newName)?d.newName:d.original}</td>
    <td>${d.type}</td><td>${d.section}</td><td>${d.date}</td><td>${d.desc}</td><td>${d.directorate}</td>
    <td><a href="${d.link}" target="_blank">View</a></td>
    <td><button class="mini-btn" onclick="fillFormFromExisting('${encodeURIComponent(d.link)}')">Edit</button></td>
  </tr>`).join('');
  document.getElementById('meta').textContent = `${filtered.length} documents`;
};
