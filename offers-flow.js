import { auth, db } from './firebase.js';
import { doc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

document.addEventListener('click', async (event) => {
  const acceptButton = event.target.closest('[data-offer-action="accept-counter"]');
  if (acceptButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const user=auth.currentUser,offerId=acceptButton.dataset.offerId;
    if(!user||!offerId)return;
    const original=acceptButton.textContent;
    try{
      acceptButton.disabled=true;acceptButton.textContent='Accepting…';
      const offerRef=doc(db,'offers',offerId),snap=await getDoc(offerRef);
      if(!snap.exists())throw new Error('Offer not found');
      const offer=snap.data();
      if(offer.buyerId!==user.uid||offer.status!=='countered')throw new Error('Counter unavailable');
      await updateDoc(offerRef,{status:'accepted',acceptedAt:serverTimestamp(),updatedAt:serverTimestamp()});
      if(offer.listingId)await updateDoc(doc(db,'listings',offer.listingId),{status:'pending',reservedForBuyerId:user.uid,acceptedOfferId:offerId,pendingAt:serverTimestamp(),updatedAt:serverTimestamp()});
      window.location.reload();
    }catch(error){console.error(error);acceptButton.disabled=false;acceptButton.textContent=original;}
    return;
  }

  const choice=event.target.closest('[data-fulfillment-choice]');
  if(!choice)return;
  const user=auth.currentUser,offerId=choice.dataset.offerId,method=choice.dataset.fulfillmentChoice;
  if(!user||!offerId||!['pickup','shipping'].includes(method))return;
  try{
    choice.disabled=true;
    const offerRef=doc(db,'offers',offerId),snap=await getDoc(offerRef);
    if(!snap.exists())throw new Error('Offer not found');
    const offer=snap.data();
    if(offer.buyerId!==user.uid||offer.status!=='accepted')throw new Error('Offer unavailable');
    await updateDoc(offerRef,{fulfillmentMethod:method,fulfillmentSelectedAt:serverTimestamp(),updatedAt:serverTimestamp()});
    decorateAcceptedOffers();
  }catch(error){console.error(error);choice.disabled=false;alert('That choice could not be saved yet.');}
},true);

async function decorateAcceptedOffers(){
  const root=document.getElementById('my-offers-results');if(!root)return;
  for(const card of root.querySelectorAll('.offer-card')){
    const state=card.querySelector('.offer-state');
    if(!state||state.textContent.trim().toLowerCase()!=='accepted')continue;
    const buttons=card.querySelectorAll('[data-offer-action]');
    let offerId='';buttons.forEach(b=>{if(b.dataset.offerId)offerId=b.dataset.offerId});
    if(!offerId){
      const cards=[...root.querySelectorAll('.offer-card')],index=cards.indexOf(card);
      const user=auth.currentUser;if(!user)continue;
      try{
        const {collection,query,where,getDocs}=await import('https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js');
        const s=await getDocs(query(collection(db,'offers'),where('buyerId','==',user.uid))),offers=[];
        s.forEach(d=>offers.push({id:d.id,...d.data()}));offers.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
        const accepted=offers.filter(o=>o.status==='accepted');
        const title=card.querySelector('h3')?.textContent||'';
        const match=accepted.find(o=>(o.listingTitle||'Listing')===title)||accepted[index];
        offerId=match?.id||'';
      }catch{}
    }
    if(!offerId)continue;
    let box=card.querySelector('.purchase-required');if(box)box.remove();
    const snap=await getDoc(doc(db,'offers',offerId));if(!snap.exists())continue;const offer=snap.data();
    box=document.createElement('div');box.className='purchase-required';
    if(offer.fulfillmentMethod==='pickup')box.innerHTML='<strong>🐾 Local pickup selected</strong><p>This item is reserved for you. Next we’ll add meetup coordination and cash-payment completion.</p>';
    else if(offer.fulfillmentMethod==='shipping')box.innerHTML='<strong>📦 Shipping selected</strong><p>This item is reserved for you. Online checkout and shipping payment are the next part we’ll connect.</p>';
    else box.innerHTML=`<strong>🎉 Your offer was accepted!</strong><p>This item is reserved for you. How would you like to receive it?</p><div class="listing-actions"><button class="mini-btn sold" data-fulfillment-choice="pickup" data-offer-id="${offerId}">Local Pickup</button><button class="mini-btn edit" data-fulfillment-choice="shipping" data-offer-id="${offerId}">Ship It</button></div>`;
    card.appendChild(box);
  }
}
const root=document.getElementById('my-offers-results');if(root){new MutationObserver(()=>decorateAcceptedOffers()).observe(root,{childList:true,subtree:true});setTimeout(decorateAcceptedOffers,500);}
