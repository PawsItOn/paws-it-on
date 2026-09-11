// Paws It On offers-page presentation enhancement.
// Keeps transaction logic intact and reshapes the rendered cards into compact rows.
const roots=['incoming-offers-results','my-offers-results'];

function cardKey(card){
  const title=card.querySelector('h3')?.textContent.trim()||'';
  const price=card.querySelector('.offer-price')?.textContent.trim()||'';
  const state=card.querySelector('.offer-state')?.textContent.trim().toLowerCase()||'';
  return `${title}|${price}|${state}`;
}

function dedupe(grid){
  const seen=new Map();
  [...grid.querySelectorAll(':scope > .offer-card')].forEach(card=>{
    const key=cardKey(card);
    if(!key)return;
    if(!seen.has(key)){seen.set(key,card);return;}
    const first=seen.get(key),firstHas=!!first.querySelector('.purchase-required'),thisHas=!!card.querySelector('.purchase-required');
    if(thisHas&&!firstHas){first.remove();seen.set(key,card);}else card.remove();
  });
}

function ensureHeader(root){
  if(root.querySelector('.offers-table-head'))return;
  const grid=root.querySelector('.offers-grid');
  if(!grid)return;
  const head=document.createElement('div');
  head.className='offers-table-head';
  head.innerHTML='<span>ITEM</span><span>STATUS</span><span>DELIVERY</span><span>ACTIONS</span>';
  grid.before(head);
}

function transformCard(card){
  if(card.dataset.tableReady==='1')return;
  const state=card.querySelector('.offer-state');
  const title=card.querySelector('h3');
  const price=card.querySelector('.offer-price');
  if(!state||!title||!price)return;

  const counter=card.querySelector('.counter-note');
  const purchase=card.querySelector('.purchase-required');
  const directActions=[...card.children].find(el=>el.classList?.contains('listing-actions'));

  const item=document.createElement('div');item.className='offer-item-cell';
  const status=document.createElement('div');status.className='offer-status-cell';
  const delivery=document.createElement('div');delivery.className='offer-delivery-cell';
  const actions=document.createElement('div');actions.className='offer-actions-cell';

  item.append(title,price);if(counter)item.append(counter);
  status.append(state);

  if(purchase){
    const strong=purchase.querySelector('strong');
    const note=purchase.querySelector('p');
    const actionRow=purchase.querySelector('.listing-actions');
    if(strong){strong.classList.add('delivery-primary');delivery.append(strong);}
    if(note){note.classList.add('delivery-secondary');delivery.append(note);}
    if(actionRow)actions.append(actionRow);
    purchase.remove();
  }else{
    delivery.innerHTML='<span class="delivery-dash">—</span>';
    if(directActions)actions.append(directActions);
  }

  if(!actions.children.length)actions.innerHTML='<span class="delivery-dash">—</span>';
  card.replaceChildren(item,status,delivery,actions);
  card.dataset.tableReady='1';
  const stateText=state.textContent.trim().toLowerCase();
  if(['completed','sold','declined','expired','withdrawn'].includes(stateText))card.classList.add('historical-offer');
}

function compactRoot(root){
  if(!root)return;
  const grid=root.querySelector('.offers-grid');
  if(!grid)return;
  dedupe(grid);
  ensureHeader(root);
  [...grid.querySelectorAll(':scope > .offer-card')].forEach(transformCard);
}

function run(){roots.forEach(id=>compactRoot(document.getElementById(id)));}
let timer;
function schedule(){clearTimeout(timer);timer=setTimeout(run,100);}
roots.forEach(id=>{const root=document.getElementById(id);if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true});});
setTimeout(run,500);
