import { auth, db } from './firebase.js';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

document.addEventListener('click',async event=>{
  const acceptButton=event.target.closest('[data-offer-action="accept-counter"]');
  if(acceptButton){
    event.preventDefault();event.stopImmediatePropagation();
    const user=auth.currentUser,offerId=acceptButton.dataset.offerId;if(!user||!offerId)return;
    const original=acceptButton.textContent;
    try{
      acceptButton.disabled=true;acceptButton.textContent='Accepting…';
      const offerRef=doc(db,'offers',offerId),snap=await getDoc(offerRef);if(!snap.exists())throw new Error('Offer not found');
      const offer=snap.data();if(offer.buyerId!==user.uid||offer.status!=='countered')throw new Error('Counter unavailable');
      await updateDoc(offerRef,{status:'accepted',acceptedAt:serverTimestamp(),updatedAt:serverTimestamp()});
      if(offer.listingId)await updateDoc(doc(db,'listings',offer.listingId),{status:'pending',reservedForBuyerId:user.uid,acceptedOfferId:offerId,pendingAt:serverTimestamp(),updatedAt:serverTimestamp()});
      window.location.reload();
    }catch(error){console.error(error);acceptButton.disabled=false;acceptButton.textContent=original;}
    return;
  }
  const choice=event.target.closest('[data-fulfillment-choice]');if(!choice)return;
  const user=auth.currentUser,offerId=choice.dataset.offerId,method=choice.dataset.fulfillmentChoice;if(!user||!offerId||!['pickup','shipping'].includes(method))return;
  try{
    choice.disabled=true;const offerRef=doc(db,'offers',offerId),snap=await getDoc(offerRef);if(!snap.exists())throw new Error('Offer not found');
    const offer=snap.data();if(offer.buyerId!==user.uid||offer.status!=='accepted')throw new Error('Offer unavailable');
    await updateDoc(offerRef,{fulfillmentMethod:method,fulfillmentSelectedAt:serverTimestamp(),updatedAt:serverTimestamp()});
    await syncAcceptedOffers();
  }catch(error){console.error(error);choice.disabled=false;alert('That choice could not be saved yet.');}
},true);

function acceptedBox(o){
  if(o.fulfillmentMethod==='pickup')return '<div class="purchase-required"><strong>🐾 Local pickup selected</strong><p>This item is reserved for you. Next we’ll add meetup coordination and cash-payment completion.</p></div>';
  if(o.fulfillmentMethod==='shipping')return '<div class="purchase-required"><strong>📦 Shipping selected</strong><p>This item is reserved for you. Online checkout and shipping payment are the next part we’ll connect.</p></div>';
  return `<div class="purchase-required"><strong>🎉 Your offer was accepted!</strong><p>This item is reserved for you. How would you like to receive it?</p><div class="listing-actions"><button class="mini-btn sold" data-fulfillment-choice="pickup" data-offer-id="${esc(o.id)}">Local Pickup</button><button class="mini-btn edit" data-fulfillment-choice="shipping" data-offer-id="${esc(o.id)}">Ship It</button></div></div>`;
}
function acceptedCard(o){return `<article class="offer-card" data-accepted-offer-id="${esc(o.id)}"><span class="offer-state accepted">ACCEPTED</span><h3>${esc(o.listingTitle||'Listing')}</h3><p class="offer-price">Your offer: $${Number(o.counterAmount||o.amount||0).toFixed(2)}</p>${acceptedBox(o)}</article>`;}

async function syncAcceptedOffers(){
  const root=document.getElementById('my-offers-results'),user=auth.currentUser;if(!root||!user)return;
  try{
    const snap=await getDocs(query(collection(db,'offers'),where('buyerId','==',user.uid))),accepted=[];
    snap.forEach(d=>{const o={id:d.id,...d.data()};if(o.status==='accepted')accepted.push(o);});
    accepted.sort((a,b)=>(b.acceptedAt?.seconds||b.updatedAt?.seconds||b.createdAt?.seconds||0)-(a.acceptedAt?.seconds||a.updatedAt?.seconds||a.createdAt?.seconds||0));
    if(!accepted.length)return;
    let grid=root.querySelector('.offers-grid');
    if(!grid){root.innerHTML='<div class="offers-grid"></div>';grid=root.querySelector('.offers-grid');}
    for(const o of accepted){
      const existing=grid.querySelector(`[data-accepted-offer-id="${CSS.escape(o.id)}"]`);
      const legacy=[...grid.querySelectorAll('.offer-card')].find(c=>c.querySelector('.offer-state')?.textContent.trim().toLowerCase()==='accepted'&&c.querySelector('h3')?.textContent.trim()===(o.listingTitle||'Listing'));
      if(existing)existing.outerHTML=acceptedCard(o);else if(legacy)legacy.outerHTML=acceptedCard(o);else grid.insertAdjacentHTML('afterbegin',acceptedCard(o));
    }
  }catch(error){console.error('Accepted offer sync failed',error);}
}

let syncTimer;
function scheduleSync(){clearTimeout(syncTimer);syncTimer=setTimeout(syncAcceptedOffers,150);}
const root=document.getElementById('my-offers-results');if(root)new MutationObserver(scheduleSync).observe(root,{childList:true,subtree:true});
auth.onAuthStateChanged(user=>{if(user)setTimeout(syncAcceptedOffers,300);});
