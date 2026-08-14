import { db } from './firebase.js';
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

const target=document.getElementById('live-listings');
if(target){
  try{
    const snap=await getDocs(query(collection(db,'listings'),where('status','==','active')));
    if(snap.empty){ target.innerHTML='<p class="marketplace-note"><strong>No live community listings yet.</strong><span>Your first test listing will appear here after it is published.</span></p>'; }
    else{
      target.innerHTML='';
      snap.forEach(doc=>{ const x=doc.data(); const card=document.createElement('article'); card.className='listing-card'; card.innerHTML=`<div class="listing-image-wrap"><div class="category-fallback">🐾</div></div><div class="listing-body"><div class="seller-row"><span class="community">COMMUNITY SELLER</span></div><h3>${esc(x.title)}</h3><p class="listing-meta">${esc(x.condition||'Used')} · ${x.shipping?'Shipping ':''}${x.pickup?'Local Pickup':''}</p><div class="price-row"><strong>$${Number(x.price||0).toFixed(0)}</strong>${x.acceptOffers?'<button disabled>Make Offer</button>':''}</div><p>${esc(x.description||'')}</p></div>`; target.appendChild(card); });
    }
  }catch(e){ console.error(e); target.innerHTML='<p class="marketplace-note"><strong>Live listings are not readable yet.</strong><span>Publish the Firestore rules, then refresh this page.</span></p>'; }
}
function esc(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
