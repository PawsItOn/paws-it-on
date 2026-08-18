import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { collection, getDocs, query, where, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

const target=document.getElementById('live-listings');
let currentUser=null;
let listings=[];
let savedIds=new Set();

onAuthStateChanged(auth,async user=>{
  currentUser=user;
  savedIds=new Set();
  if(user) await loadSavedIds(user.uid);
  renderListings();
});

async function loadSavedIds(uid){
  try{
    const snap=await getDocs(query(collection(db,'favorites'),where('userId','==',uid)));
    snap.forEach(d=>{const x=d.data();if(x.listingId)savedIds.add(x.listingId);});
  }catch(e){console.warn('Could not load favorites yet',e);}
}

if(target){
  try{
    const snap=await getDocs(query(collection(db,'listings'),where('status','==','active')));
    snap.forEach(d=>listings.push({id:d.id,...d.data()}));
    listings.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    renderListings();
  }catch(e){
    console.error(e);
    target.innerHTML='<p class="marketplace-note"><strong>Live listings are not readable yet.</strong><span>Refresh in a moment or check the Firestore rules.</span></p>';
  }
}

function renderListings(){
  if(!target)return;
  if(!listings.length){target.innerHTML='<p class="marketplace-note"><strong>No live community listings yet.</strong><span>Your first listing will appear here after it is published.</span></p>';return;}
  target.innerHTML='';
  listings.forEach(x=>{
    const card=document.createElement('article');card.className='listing-card clickable';
    const photo=x.imageUrl||(Array.isArray(x.imageUrls)?x.imageUrls[0]:'');
    const imageHtml=photo?`<img src="${escAttr(photo)}" alt="${escAttr(x.title||'Used pet gear listing')}" loading="lazy">`:'<div class="category-fallback">🐾</div>';
    const saved=savedIds.has(x.id);
    card.innerHTML=`<div class="listing-image-wrap">${imageHtml}<button class="heart ${saved?'saved':''}" data-favorite-id="${escAttr(x.id)}" aria-label="${saved?'Remove from saved items':'Save item'}">${saved?'♥':'♡'}</button></div><div class="listing-body"><div class="seller-row"><span class="community">COMMUNITY SELLER</span></div><h3>${esc(x.title)}</h3><p class="listing-meta">${esc(x.condition||'Used')} · ${x.shipping?'Shipping ':''}${x.pickup?'Local Pickup':''}</p><div class="price-row"><strong>$${Number(x.price||0).toFixed(0)}</strong>${x.acceptOffers?'<button disabled>Make Offer</button>':''}</div><p>${esc(x.description||'')}</p></div>`;
    card.addEventListener('click',e=>{if(e.target.closest('[data-favorite-id]'))return;location.href=`listing.html?id=${encodeURIComponent(x.id)}`;});
    card.querySelector('[data-favorite-id]').addEventListener('click',toggleFavorite);
    target.appendChild(card);
  });
}

async function toggleFavorite(e){
  e.stopPropagation();
  const id=e.currentTarget.dataset.favoriteId;
  if(!currentUser){
    if(confirm('Sign in to save items to My Paws It On. Go to sign in now?')) location.href=`account.html?next=${encodeURIComponent(location.pathname+location.search+location.hash)}`;
    return;
  }
  const favId=`${currentUser.uid}_${id}`;
  const ref=doc(db,'favorites',favId);
  try{
    if(savedIds.has(id)){
      await deleteDoc(ref);savedIds.delete(id);
    }else{
      await setDoc(ref,{userId:currentUser.uid,listingId:id,createdAt:serverTimestamp()});savedIds.add(id);
    }
    renderListings();
  }catch(err){
    console.error(err);alert('We could not save that item yet. We may need one small Firestore security-rule update.');
  }
}

function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function escAttr(s){return esc(s).replace(/`/g,'&#96;');}
