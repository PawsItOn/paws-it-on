import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

const target=document.getElementById('listing-detail');
const id=new URLSearchParams(location.search).get('id');
let currentUser=null;
let listing=null;
let saved=false;

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
  target.innerHTML=`<a class="back-link" href="shop.html#listings">← Back to marketplace</a><div class="detail-grid"><section class="detail-gallery">${gallery}</section><section class="detail-info"><div class="detail-top-row"><div><span class="seller-badge">${x.sellerType==='verified'?'PAWS IT ON VERIFIED':'COMMUNITY SELLER'}</span><span class="status-badge ${escAttr(x.status||'active')}">${esc((x.status||'active').toUpperCase())}</span></div><button id="detail-favorite" class="detail-favorite ${saved?'saved':''}" type="button">${saved?'♥ Saved':'♡ Save Item'}</button></div><h1>${esc(x.title||'Untitled listing')}</h1><div class="detail-price">$${Number(x.price||0).toFixed(2)}</div>${x.acceptOffers?'<div class="offer-welcome">Seller is open to offers.</div>':''}<div class="detail-facts">${fact('Condition',x.condition)}${fact('Category',x.category)}${fact('Brand',x.brand)}${fact('Size',x.size)}${fact('Color',x.color)}</div><div class="detail-section"><h2>About this item</h2><p>${esc(x.description||'')}</p></div><div class="detail-section"><h2>Delivery</h2><p>${delivery.length?delivery.join(' · '):'Delivery details have not been set yet.'}</p></div><div class="detail-section seller-box"><h2>Seller</h2><p>${x.sellerType==='verified'?'Sold directly by Paws It On.':'Listed by a Paws It On community seller.'}</p></div><div class="future-actions"><button class="btn btn-yellow" disabled>Make Offer — Coming Soon</button><button class="btn btn-teal" disabled>Buy Now — Coming Soon</button></div></section></div>`;
  document.querySelectorAll('.thumb').forEach(btn=>btn.addEventListener('click',()=>{const main=document.getElementById('detail-main-image');if(main)main.src=btn.dataset.src;document.querySelectorAll('.thumb').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}));
  document.getElementById('detail-favorite')?.addEventListener('click',toggleFavorite);
}

async function toggleFavorite(){
  if(!currentUser){if(confirm('Sign in to save this item to My Paws It On. Go to sign in now?'))location.href=`account.html?next=${encodeURIComponent(location.pathname+location.search)}`;return;}
  const ref=doc(db,'favorites',`${currentUser.uid}_${id}`);
  try{
    if(saved){await deleteDoc(ref);saved=false;}else{await setDoc(ref,{userId:currentUser.uid,listingId:id,createdAt:serverTimestamp()});saved=true;}
    render();
  }catch(e){console.error(e);alert('We could not save that item yet. We may need one small Firestore security-rule update.');}
}

function fact(label,value){return value?`<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`:'';}
function esc(s){return String(s??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));}
function escAttr(s){return esc(s).replace(/`/g,'&#96;');}
