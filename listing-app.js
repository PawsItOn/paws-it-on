import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { collection, addDoc, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

const target=document.getElementById('listing-detail');
const id=new URLSearchParams(location.search).get('id');
let currentUser=null;
let listing=null;
let saved=false;
let offerOpen=false;

onAuthStateChanged(auth,async user=>{
  currentUser=user;
  saved=false;
  if(user&&id){
    try{saved=(await getDoc(doc(db,'favorites',`${user.uid}_${id}`))).exists();}catch(e){console.warn('Could not check favorite state',e);}
  }
  render();
});

if(!id){
  target.innerHTML='<div class="listing-error"><h1>Listing not found</h1><p>This listing link is missing an item ID.</p><a class="btn btn-teal" href="shop.html">Back to Shop</a></div>';
}else{
  try{
    const snap=await getDoc(doc(db,'listings',id));
    if(!snap.exists()) target.innerHTML='<div class="listing-error"><h1>Listing not found</h1><p>This item may have been removed.</p><a class="btn btn-teal" href="shop.html">Back to Shop</a></div>';
    else{listing={id:snap.id,...snap.data()};render();}
  }catch(e){console.error(e);target.innerHTML='<div class="listing-error"><h1>We could not load this listing.</h1><p>Please try again in a moment.</p><a class="btn btn-teal" href="shop.html">Back to Shop</a></div>';}
}

function render(){
  if(!listing)return;
  const x=listing;
  const urls=Array.isArray(x.imageUrls)&&x.imageUrls.length?x.imageUrls:(x.imageUrl?[x.imageUrl]:[]);
  const gallery=urls.length?`<div class="detail-main-photo"><img id="detail-main-image" src="${escAttr(urls[0])}" alt="${escAttr(x.title||'Listing photo')}"></div>${urls.length>1?`<div class="detail-thumbs">${urls.map((u,i)=>`<button class="thumb ${i===0?'active':''}" data-src="${escAttr(u)}" aria-label="View photo ${i+1}"><img src="${escAttr(u)}" alt="Thumbnail ${i+1}"></button>`).join('')}</div>`:''}`:'<div class="detail-main-photo fallback">🐾</div>';
  const delivery=[];if(x.shipping)delivery.push('Shipping available');if(x.pickup)delivery.push(`Local pickup${x.pickupArea?` near ${esc(x.pickupArea)}`:''}`);
  const isOwner=currentUser&&currentUser.uid===x.sellerId;
  const canOffer=x.acceptOffers&&x.status==='active'&&!isOwner;
  const offerArea=canOffer
    ? `<button id="make-offer" class="btn btn-yellow" type="button">Make Offer</button>`
    : `<button class="btn btn-yellow" disabled>${isOwner?'Your Listing':x.acceptOffers?'Offers unavailable':'Seller is not accepting offers'}</button>`;
  const offerForm=offerOpen&&canOffer?`<div class="offer-form"><label>Your offer amount<div class="offer-input"><span>$</span><input id="offer-amount" type="number" min="1" step="0.01" inputmode="decimal" placeholder="${Math.max(1,Math.floor(Number(x.price||0)*0.85))}"></div></label><p>Asking price: <strong>$${Number(x.price||0).toFixed(2)}</strong></p><div class="offer-form-actions"><button id="submit-offer" class="btn btn-teal" type="button">Send Offer</button><button id="cancel-offer" class="btn btn-ghost" type="button">Cancel</button></div><p id="offer-status" class="offer-status"></p></div>`:'';
  target.innerHTML=`<a class="back-link" href="shop.html#listings">← Back to marketplace</a><div class="detail-grid"><section class="detail-gallery">${gallery}</section><section class="detail-info"><div class="detail-top-row"><div><span class="seller-badge">${x.sellerType==='verified'?'PAWS IT ON VERIFIED':'COMMUNITY SELLER'}</span><span class="status-badge ${escAttr(x.status||'active')}">${esc((x.status||'active').toUpperCase())}</span></div><button id="detail-favorite" class="detail-favorite ${saved?'saved':''}" type="button">${saved?'♥ Saved':'♡ Save Item'}</button></div><h1>${esc(x.title||'Untitled listing')}</h1><div class="detail-price">$${Number(x.price||0).toFixed(2)}</div>${x.acceptOffers?'<div class="offer-welcome">Seller is open to offers.</div>':''}<div class="detail-facts">${fact('Condition',x.condition)}${fact('Category',x.category)}${fact('Brand',x.brand)}${fact('Size',x.size)}${fact('Color',x.color)}</div><div class="detail-section"><h2>About this item</h2><p>${esc(x.description||'')}</p></div><div class="detail-section"><h2>Delivery</h2><p>${delivery.length?delivery.join(' · '):'Delivery details have not been set yet.'}</p></div><div class="detail-section seller-box"><h2>Seller</h2><p>${x.sellerType==='verified'?'Sold directly by Paws It On.':'Listed by a Paws It On community seller.'}</p></div><div class="future-actions">${offerArea}<button class="btn btn-teal" disabled>Buy Now — Coming Soon</button></div>${offerForm}</section></div>`;
  document.querySelectorAll('.thumb').forEach(btn=>btn.addEventListener('click',()=>{const main=document.getElementById('detail-main-image');if(main)main.src=btn.dataset.src;document.querySelectorAll('.thumb').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}));
  document.getElementById('detail-favorite')?.addEventListener('click',toggleFavorite);
  document.getElementById('make-offer')?.addEventListener('click',()=>{if(!currentUser){if(confirm('Sign in to make an offer. Go to sign in now?'))location.href=`account.html?next=${encodeURIComponent(location.pathname+location.search)}`;return;}offerOpen=true;render();setTimeout(()=>document.getElementById('offer-amount')?.focus(),0);});
  document.getElementById('cancel-offer')?.addEventListener('click',()=>{offerOpen=false;render();});
  document.getElementById('submit-offer')?.addEventListener('click',submitOffer);
}

async function submitOffer(){
  const statusEl=document.getElementById('offer-status');
  if(!currentUser||!listing)return;
  const amount=Number(document.getElementById('offer-amount')?.value);
  if(!amount||amount<=0){statusEl.textContent='Enter a valid offer amount.';return;}
  if(amount>=Number(listing.price||0)){statusEl.textContent='For the full asking price, Buy Now will be available when checkout launches. Enter an offer below the asking price.';return;}
  try{
    statusEl.textContent='Sending offer…';
    await addDoc(collection(db,'offers'),{
      listingId:listing.id,
      listingTitle:listing.title||'',
      listingImage:listing.imageUrl||(Array.isArray(listing.imageUrls)?listing.imageUrls[0]:'')||'',
      askingPrice:Number(listing.price||0),
      buyerId:currentUser.uid,
      buyerEmail:currentUser.email||'',
      sellerId:listing.sellerId,
      sellerEmail:listing.sellerEmail||'',
      amount,
      counterAmount:null,
      status:'pending',
      createdAt:serverTimestamp(),
      updatedAt:serverTimestamp()
    });
    statusEl.textContent='Offer sent! You can track it under My Paws It On → My Offers.';
    document.getElementById('submit-offer').disabled=true;
  }catch(e){
    console.error(e);
    statusEl.textContent='Firebase blocked the offer. We need to add the new Offers security rule.';
  }
}

async function toggleFavorite(){
  if(!currentUser){if(confirm('Sign in to save this item to My Paws It On. Go to sign in now?'))location.href=`account.html?next=${encodeURIComponent(location.pathname+location.search)}`;return;}
  const ref=doc(db,'favorites',`${currentUser.uid}_${id}`);
  try{if(saved){await deleteDoc(ref);saved=false;}else{await setDoc(ref,{userId:currentUser.uid,listingId:id,createdAt:serverTimestamp()});saved=true;}render();}
  catch(e){console.error(e);alert('We could not save that item yet.');}
}

function fact(label,value){return value?`<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`:'';}
function esc(s){return String(s??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));}
function escAttr(s){return esc(s).replace(/`/g,'&#96;');}
