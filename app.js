import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

const DAYS=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const WD=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const SLOTS=[['manana','Mañana'],['tarde','Tarde'],['noche','Noche']];
const SL=Object.fromEntries(SLOTS);
const FIRST=1; // 1 de diciembre de 2026 es martes
const VISIT=d=>d>=18&&d<=28;
const NOTE={24:'Nochebuena',25:'Navidad',31:'Fin de año'};
const SEED=[[18,'noche','Llegan los Rodsal'],[19,'manana','Irene: odontólogo'],[19,'tarde','Irene: uñas y cejas'],[20,'noche','Llegan los Richardson'],[21,'manana','Irene: odontólogo'],[21,'manana','Richardson family: exámenes'],[21,'tarde','Beatriz: facial'],[23,'manana','Piñata Clark'],[23,'tarde','Playa'],[24,'manana','Playa'],[24,'manana','Navidad en familia'],[25,'manana','Playa'],[26,'manana','En Finca San Nicolás'],[26,'noche','Fiesta Fiorella'],[27,'noche','Cena cumple Irene'],[28,'manana','Se regresan los viajeros']];
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dayName=d=>DAYS[(FIRST+d-1)%7];
let events=[],current=null,showAll=false,lastDeleted=null,toastT=null;

const app=initializeApp(firebaseConfig);
const db=getFirestore(app);
const col=collection(db,'events');

$('fDay').innerHTML=Array.from({length:11},(_,i)=>`<option value="${i+18}">${dayName(i+18)} ${i+18}</option>`).join('');
const byDay=d=>events.filter(e=>e.day===d).sort((a,b)=>SLOTS.findIndex(s=>s[0]===a.slot)-SLOTS.findIndex(s=>s[0]===b.slot)||(a.at||0)-(b.at||0));
const chip=e=>`<span class="chip"><i class="dot d-${esc(e.slot)}"></i><span>${esc(e.title)}</span></span>`;

function render(){
  let h=WD.map(w=>`<div class="wd">${w}</div>`).join('');
  for(let i=0;i<FIRST;i++)h+='<div class="cell empty" aria-hidden="true"></div>';
  for(let d=1;d<=31;d++){
    const ev=byDay(d);
    if(!VISIT(d)){h+=`<div class="cell off" aria-hidden="true"><span class="num">${d}</span></div>`;continue;}
    h+=`<button type="button" class="cell${VISIT(d)?' visit':''}${d===24||d===25?' xmas':''}" data-d="${d}" aria-label="${dayName(d)} ${d} de diciembre, ${ev.length} planes">
      <span class="num">${d}${NOTE[d]?`<span class="tag">${NOTE[d]}</span>`:''}</span>
      ${ev.slice(0,4).map(chip).join('')}${ev.length>4?`<span class="more">+${ev.length-4} más</span>`:''}</button>`;
  }
  for(let i=0;i<(7-(FIRST+31)%7)%7;i++)h+='<div class="cell empty" aria-hidden="true"></div>';
  $('grid').innerHTML=h;
  let a='';
  for(let d=1;d<=31;d++){
    const ev=byDay(d);
    if(!VISIT(d))continue;
    a+=`<button type="button" class="aday${VISIT(d)?' visit':''}" data-d="${d}"><span class="num">${d}<small>${dayName(d)}</small></span>
      <span>${ev.length?ev.map(chip).join(''):'<span class="none">Día libre</span>'}${NOTE[d]?`<span class="tag">${NOTE[d]}</span>`:''}</span></button>`;
  }
  $('agenda').innerHTML=a;
  if(current)renderSheet();
}

function renderSheet(){
  const d=current,ev=byDay(d);
  $('shTitle').textContent=`${dayName(d)} ${d}`;
  $('shSub').textContent=(NOTE[d]?NOTE[d]+' · ':'')+(ev.length?`${ev.length} ${ev.length===1?'plan':'planes'}`:'Sin planes todavía');
  $('shBody').innerHTML=SLOTS.map(([k,l])=>{
    const list=ev.filter(e=>e.slot===k);
    return `<div class="slot"><h3><i class="dot d-${k}"></i>${l}</h3>${list.length?list.map(e=>`<div class="ev"><span class="tx">${esc(e.title)}</span><button type="button" class="x" data-del="${esc(e.id)}" aria-label="Quitar ${esc(e.title)}">Quitar</button></div>`).join(''):'<p class="nil">Nada planeado</p>'}</div>`;
  }).join('');
  $('fDay').value=String(d);
}

function openDay(d){if(!VISIT(d))return;current=d;renderSheet();$('wrap').classList.add('open');$('sheet').setAttribute('aria-hidden','false');setTimeout(()=>$('fTitle').focus(),50);}
function close(){current=null;$('wrap').classList.remove('open');$('sheet').setAttribute('aria-hidden','true');}
const setStatus=t=>{$('status').textContent=t;};
const fail=()=>setStatus('No se pudo guardar. Revisa tu conexión e intenta otra vez.');

document.addEventListener('click',e=>{
  const c=e.target.closest('[data-d]');if(c){openDay(+c.dataset.d);return;}
  const x=e.target.closest('[data-del]');
  if(x){
    if(!x.classList.contains('arm')){x.classList.add('arm');x.textContent='¿Seguro?';setTimeout(()=>{if(x.isConnected){x.classList.remove('arm');x.textContent='Quitar';}},3000);return;}
    remove(x.dataset.del);
  }
});
$('addBtn').onclick=()=>openDay(current||18);
$('closeBtn').onclick=close;$('scrim').onclick=close;
document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});

$('form').addEventListener('submit',async e=>{
  e.preventDefault();
  const title=$('fTitle').value.trim();if(!title)return;
  const day=+$('fDay').value,slot=$('fSlot').value;
  if(!VISIT(day))return;
  $('fSave').disabled=true;
  try{await addDoc(col,{day,slot,title:title.slice(0,120),at:Date.now()});$('fTitle').value='';if(day!==current)openDay(day);}
  catch(err){fail();}
  $('fSave').disabled=false;
});

async function remove(id){
  const ev=events.find(e=>e.id===id);if(!ev)return;
  try{
    await deleteDoc(doc(db,'events',id));
    lastDeleted=ev;$('toastMsg').textContent=`Se quitó “${ev.title}”`;$('toast').classList.add('on');
    clearTimeout(toastT);toastT=setTimeout(()=>$('toast').classList.remove('on'),6000);
  }catch(err){fail();}
}
$('undoBtn').onclick=async()=>{
  if(!lastDeleted)return;const {id,day,slot,title,at}=lastDeleted;lastDeleted=null;$('toast').classList.remove('on');
  try{await setDoc(doc(db,'events',id),{day,slot,title,at});}catch(err){fail();}
};

render();
let seeded=false;
const timer=setTimeout(()=>setStatus('No se puede conectar todavía. Los planes pueden no estar al día.'),10000);
onSnapshot(col,{includeMetadataChanges:false},snap=>{
  events=snap.docs.map(d=>{const x=d.data()||{};return{id:d.id,day:+x.day||0,slot:SL[x.slot]?x.slot:'manana',title:String(x.title||''),at:+x.at||0};}).filter(e=>e.day>=1&&e.day<=31&&e.title);
  if(!snap.metadata.fromCache){
    clearTimeout(timer);
    setStatus('Los cambios se guardan al instante y se ven en todos los teléfonos.');
    if(snap.empty&&location.hash==='#seed'&&!seeded){
      seeded=true;
      SEED.forEach(([day,slot,title],i)=>setDoc(doc(db,'events','e'+String(i+1).padStart(2,'0')),{day,slot,title,at:i+1}).catch(fail));
      history.replaceState(null,'',location.pathname);
    }
  }
  render();
},()=>{clearTimeout(timer);setStatus('Se perdió la conexión con el calendario. Recarga la página más tarde.');});
