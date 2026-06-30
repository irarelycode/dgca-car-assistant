let DATA=[];
const statusEl=document.getElementById('status'); const metaEl=document.getElementById('meta');
statusEl.href=SHEET_VIEW_URL;

// Theme
const tt=document.getElementById('themeToggle');
function setTheme(t){document.documentElement.setAttribute('data-theme',t);localStorage.setItem('theme',t);tt.textContent=t==='dark'?'🌙':'☀️';}
setTheme(localStorage.getItem('theme')||'dark'); tt.onclick=()=>setTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark');

async function loadSheet(){
  statusEl.textContent='Loading...'; statusEl.style.color='';
  try{
    const url=SHEET_CSV_URL+'&_='+Date.now();
    console.log('Fetching',url);
    const res=await fetch(url,{cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const csv=await res.text();
    const parsed=Papa.parse(csv,{header:true,skipEmptyLines:true});
    DATA=parsed.data.map(r=>({
      link:(r['Website Document Link']||'').trim(),
      original:(r['Original File Name']||'').trim(),
      newName:(r['New File Name']||'').trim(),
      ocr:(r['OCR Required']||'').trim(),
      type:(r['Type']||'').trim(),
      section:(r['Section']||'').trim(),
      date:(r['Date of Amendment']||'').trim(),
      desc:(r['Description']||'').trim(),
      services:Array.from({length:21},(_,i)=>r['Service'+(i+1)]||'').filter(Boolean),
      directorate: (Array.from({length:21},(_,i)=>r['Service'+(i+1)]||'').join(' ').match(/Directorate\s*=\s*([A-Za-z]+)/)||[])[1]||''
    })).filter(x=>x.link);
    statusEl.textContent=`Live • ${DATA.length} docs`; statusEl.style.color='#22c55e';
    buildFilters(); renderTable(); buildSuggestions(); metaEl.textContent='Last sync: '+new Date().toLocaleTimeString();
  }catch(e){
    console.error(e); statusEl.textContent='Offline – check CSV link'; statusEl.style.color='#ef4444';
    DATA=[]; renderTable();
  }
}
function buildFilters(){
  const dirs=[...new Set(DATA.map(d=>d.directorate).filter(Boolean))].sort();
  const secs=[...new Set(DATA.map(d=>d.section).filter(Boolean))].sort();
  document.getElementById('directorate').innerHTML='<option value="">All Directorates</option>'+dirs.map(d=>`<option>${d}</option>`).join('');
  document.getElementById('section').innerHTML='<option value="">All Sections</option>'+secs.map(s=>`<option>${s}</option>`).join('');
}
function renderTable(){
  const q=document.getElementById('search').value.toLowerCase();
  const dir=document.getElementById('directorate').value;
  const sec=document.getElementById('section').value;
  const tbody=document.querySelector('#tbl tbody');
  const filtered=DATA.filter(d=>{const hay=`${d.original} ${d.newName} ${d.desc} ${d.section}`.toLowerCase(); return (!q||hay.includes(q))&&(!dir||d.directorate===dir)&&(!sec||d.section===sec);});
  tbody.innerHTML=filtered.map(d=>`<tr><td>${d.newName&&!/no change/i.test(d.newName)?d.newName:d.original}</td><td>${d.type}</td><td>${d.section}</td><td>${d.date}</td><td>${d.desc}</td><td>${d.directorate}</td><td><a href="${d.link}" target="_blank">View</a></td><td><button class="mini-btn" onclick="editFromTable('${encodeURIComponent(d.link)}')">Edit</button></td></tr>`).join('');
  metaEl.textContent=`${filtered.length} of ${DATA.length} documents`;
}
function buildSuggestions(){const qs=['What is CAR 21?','How to register aircraft?','CAR-M requirements?'];document.getElementById('suggest').innerHTML=qs.map(q=>`<button>${q}</button>`).join('');document.querySelectorAll('#suggest button').forEach(b=>b.onclick=()=>ask(b.textContent));}
function findRelevant(q,n=6){const w=q.toLowerCase().split(/\W+/);return DATA.map(d=>({...d,score:w.reduce((s,x)=>s+(x.length>3&&(d.desc+d.section).toLowerCase().includes(x)?1:0),0)})).sort((a,b)=>b.score-a.score).slice(0,n);}
async function ask(text){const m=document.getElementById('messages');m.innerHTML+=`<div class="msg user">${text}</div>`;const think=document.createElement('div');think.className='msg bot';think.textContent='Thinking...';m.appendChild(think);m.scrollTop=m.scrollHeight;try{const rel=findRelevant(text);const ctx=rel.map((d,i)=>`${i+1}. ${d.desc} | ${d.original} | ${d.section} | ${d.date}`).join('\n');const res=await fetch(WORKER_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:GROQ_MODEL,messages:[{role:'system',content:'Answer using only provided DGCA docs'},{role:'user',content:`Context:\n${ctx}\n\nQ: ${text}`}],temperature:0.1})});const data=await res.json();think.innerHTML=(data.choices?.[0]?.message?.content||'No reply').replace(/\n/g,'<br>');}catch(e){think.textContent='Error: '+e.message;}m.scrollTop=m.scrollHeight;document.getElementById('chatInput').value='';}
document.getElementById('send').onclick=()=>{const v=document.getElementById('chatInput').value.trim();if(v)ask(v)};document.getElementById('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('send').click()});
['search','directorate','section'].forEach(id=>document.getElementById(id).addEventListener('input',renderTable));
document.getElementById('refresh').onclick=loadSheet;
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));t.classList.add('active');document.getElementById(t.dataset.tab).classList.add('active')});

// Manage
function editFromTable(enc){const link=decodeURIComponent(enc);const d=DATA.find(x=>x.link===link);if(!d)return;document.querySelector('[data-tab="manage"]').click();const f=document.getElementById('docForm');f.link.value=d.link;f.original.value=d.original;f.newName.value=d.newName;f.ocr.value=d.ocr;f.type.value=d.type;f.date.value=d.date;f.section.value=d.section;f.desc.value=d.desc;f.service1.value=d.services[0]||'';}
document.getElementById('checkBtn').onclick=()=>{const link=document.getElementById('docForm').link.value.trim();const dup=document.getElementById('duplicateCard');const st=document.getElementById('formStatus');if(!link){st.textContent='Enter link';return;}const ex=DATA.find(d=>d.link===link);if(ex){dup.classList.remove('hidden');dup.innerHTML=`<h3>Found in sheet</h3><p><strong>${ex.original}</strong><br>${ex.section} • ${ex.date}</p><p>${ex.desc}</p>`;st.textContent='Duplicate exists';}else{dup.classList.add('hidden');st.textContent='Not found - safe to add';}};

loadSheet(); setInterval(loadSheet,300000);
