// Paws It On offers-page presentation enhancement.
// Keeps account.js / offers-flow.js transaction logic intact and only changes layout/order.
const roots=['incoming-offers-results','my-offers-results'];

function secondsFromCard(card){
  // offer-flow/account.js do not expose timestamps in the rendered HTML, so cards are
  // assigned their current data order; account.js already loads offers newest-first.
  return Number(card.dataset.offerSort || 0);
}

function compactRoot(root){
  if(!root)return;
  const grid=root.querySelector('.offers-grid');
  if(!grid)return;
  const cards=[...grid.querySelectorAll(':scope > .offer-card')];
  if(!cards.length)return;

  // account.js renders Firestore offers newest-first. offers-flow may prepend accepted
  // cards afterward, so preserve the freshest accepted card at the top and otherwise
  // keep the existing newest-first sequence stable.
  cards.forEach((card,index)=>{
    if(!card.dataset.offerSort) card.dataset.offerSort=String(cards.length-index);
    card.classList.add('compact-offer-card');
    const state=card.querySelector('.offer-state')?.textContent.trim().toLowerCase();
    if(['completed','sold'].includes(state)) card.classList.add('historical-offer');
  });
  cards.sort((a,b)=>secondsFromCard(b)-secondsFromCard(a)).forEach(c=>grid.appendChild(c));
}

function run(){roots.forEach(id=>compactRoot(document.getElementById(id)));}
let timer;
function schedule(){clearTimeout(timer);timer=setTimeout(run,80);}
roots.forEach(id=>{const root=document.getElementById(id);if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true});});
setTimeout(run,500);
