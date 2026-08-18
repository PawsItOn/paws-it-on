import { db } from './firebase.js';
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

const target=document.getElementById('live-listings');
if(target){
  try{
    const snap=await getDocs(query(collection(db,'listings'),where('status','==','active')));
    if(snap.empty){
      target.innerHTML='<p class="marketplace-note"><strong>No live community listings yet.</strong><span>Your first listing will appear here after it is published.</span></p>';
    } else {
      const items=[];
      snap.forEach(d=>items.push({id:d.id,...d.data()}));
      items.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
      target.innerHTML='';
      items.forEach(x=>{
        const card=document.createElement('article');
        card.className='listing-card';
        const photo=x.imageUrl || (Array.isArray(x.imageUrls) ? x.imageUrls[0] : '');
        const imageHtml=photo
          ? `<img src="${escAttr(photo)}" alt="${escAttr(x.title || 'Used pet gear listing')}" loading="lazy">`
          : '<div class="category-fallback">🐾</div>';
        card.innerHTML=`<div class="listing-image-wrap">${imageHtml}</div><div class="listing-body"><div class="seller-row"><span class="community">COMMUNITY SELLER</span></div><h3>${esc(x.title)}</h3><p class="listing-meta">${esc(x.condition||'Used')} · ${x.shipping?'Shipping ':''}${x.pickup?'Local Pickup':''}</p><div class="price-row"><strong>$${Number(x.price||0).toFixed(0)}</strong>${x.acceptOffers?'<button disabled>Make Offer</button>':''}</div><p>${esc(x.description||'')}</p></div>`;
        target.appendChild(card);
      });
    }
  } catch(e) {
    console.error(e);
    target.innerHTML='<p class="marketplace-note"><strong>Live listings are not readable yet.</strong><span>Refresh in a moment or check the Firestore rules.</span></p>';
  }
}
function esc(s){return String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function escAttr(s){return esc(s).replace(/`/g,'&#96;');}
