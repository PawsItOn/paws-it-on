import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

const email = document.getElementById('email');
const password = document.getElementById('password');
const status = document.getElementById('auth-status');
const form = document.getElementById('auth-form');
const signedInBox = document.getElementById('signed-in-box');
const signedInTools = document.getElementById('signed-in-tools');
const signOutBtn = document.getElementById('sign-out');
const intro = document.getElementById('account-intro');
const myListings = document.getElementById('my-listings');
const results = document.getElementById('my-listings-results');
let listingCache = new Map();

const categories = [
  'Collars, Harnesses & Leashes','Crates, Kennels & Gates','Beds & Blankets','Carriers & Travel Gear','Puppy Stuff','Puppy & Whelping Supplies','Clothing, Shoes & Accessories','Toys & Enrichment','Bowls, Feeders & Waterers','Grooming & Care','Training Gear','Cat Gear','Other Pet Gear'
];
const conditions = ['Like New','Very Good','Good','Well Loved / Fully Functional'];

function showSignedIn(user) {
  form.hidden = true;
  form.style.setProperty('display', 'none', 'important');
  signedInBox.hidden = false;
  signedInBox.style.display = 'block';
  signedInTools.hidden = false;
  signedInTools.style.display = 'flex';
  myListings.hidden = false;
  myListings.style.display = 'block';
  intro.textContent = 'Welcome back. Manage your Paws It On account and listings here.';
  signedInBox.innerHTML = `<strong>Signed in as ${escapeHtml(user.email || 'Paws It On member')}</strong>`;
}

function showSignedOut() {
  signedInBox.hidden = true;
  signedInBox.style.display = 'none';
  signedInTools.hidden = true;
  signedInTools.style.display = 'none';
  myListings.hidden = true;
  myListings.style.display = 'none';
  form.hidden = false;
  form.style.setProperty('display', 'grid', 'important');
  intro.textContent = 'Sign in or create an account to buy and sell on Paws It On.';
}

document.getElementById('create-account').addEventListener('click', async () => {
  try { await createUserWithEmailAndPassword(auth, email.value.trim(), password.value); status.textContent='Account created. You are signed in.'; }
  catch (e) { status.textContent = friendly(e); }
});

document.getElementById('sign-in').addEventListener('click', async () => {
  try { await signInWithEmailAndPassword(auth, email.value.trim(), password.value); status.textContent='Signed in.'; }
  catch (e) { status.textContent = friendly(e); }
});

signOutBtn.addEventListener('click', async()=>{ await signOut(auth); status.textContent='Signed out.'; });

onAuthStateChanged(auth, async user => {
  if (user) {
    showSignedIn(user);
    await loadMyListings(user.uid);
  } else {
    showSignedOut();
  }
});

async function loadMyListings(uid) {
  results.innerHTML = '<p>Loading your listings…</p>';
  try {
    const q = query(collection(db, 'listings'), where('sellerId', '==', uid));
    const snap = await getDocs(q);
    if (snap.empty) {
      listingCache = new Map();
      results.innerHTML = '<div class="empty-listings"><strong>No listings yet.</strong><p>When you publish gear, it will appear here so you can manage it.</p></div>';
      return;
    }
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    items.sort((a,b) => ((b.createdAt?.seconds||0) - (a.createdAt?.seconds||0)));
    listingCache = new Map(items.map(item => [item.id, item]));
    results.innerHTML = items.map(renderListing).join('');
    bindListingButtons();
  } catch (e) {
    console.error(e);
    results.innerHTML = '<div class="empty-listings">We could not load your listings yet. The Firestore rules may need one small update.</div>';
  }
}

function bindListingButtons() {
  results.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', handleListingAction));
}

function renderListing(item) {
  const delivery = [item.shipping ? 'Shipping' : '', item.pickup ? 'Local pickup' : ''].filter(Boolean).join(' · ') || 'Delivery not set';
  return `<article class="seller-listing" data-id="${escapeHtml(item.id)}">
    <span class="listing-state">${escapeHtml(item.status || 'active')}</span>
    <h3>${escapeHtml(item.title || 'Untitled listing')}</h3>
    <p class="listing-meta"><strong>$${Number(item.price || 0).toFixed(2)}</strong> · ${escapeHtml(item.condition || '')}</p>
    <p class="listing-meta">${escapeHtml(item.category || '')} · ${escapeHtml(delivery)}</p>
    ${item.brand ? `<p class="listing-meta">Brand: ${escapeHtml(item.brand)}</p>` : ''}
    ${item.size ? `<p class="listing-meta">Size: ${escapeHtml(item.size)}</p>` : ''}
    ${item.color ? `<p class="listing-meta">Color: ${escapeHtml(item.color)}</p>` : ''}
    <p>${escapeHtml(item.description || '')}</p>
    <div class="listing-actions">
      <button class="mini-btn edit" data-action="edit" data-id="${escapeHtml(item.id)}">Edit Listing</button>
      <button class="mini-btn sold" data-action="sold" data-id="${escapeHtml(item.id)}">Mark Sold</button>
      <button class="mini-btn remove" data-action="remove" data-id="${escapeHtml(item.id)}">Remove Listing</button>
    </div>
  </article>`;
}

function renderEditor(item) {
  const categoryOptions = categories.map(c => `<option ${c===item.category?'selected':''}>${escapeHtml(c)}</option>`).join('');
  const conditionOptions = conditions.map(c => `<option ${c===item.condition?'selected':''}>${escapeHtml(c)}</option>`).join('');
  return `<div class="listing-editor" data-editor-id="${escapeHtml(item.id)}">
    <h4>Edit full listing</h4>
    <div class="edit-grid">
      <label>Item title<input data-field="title" value="${escapeAttr(item.title||'')}"></label>
      <label>Category<select data-field="category">${categoryOptions}</select></label>
      <label>Brand<input data-field="brand" value="${escapeAttr(item.brand||'')}"></label>
      <label>Size<input data-field="size" value="${escapeAttr(item.size||'')}"></label>
      <label>Color<input data-field="color" value="${escapeAttr(item.color||'')}"></label>
      <label>Condition<select data-field="condition">${conditionOptions}</select></label>
      <label>Price<input data-field="price" type="number" min="0.01" step="0.01" inputmode="decimal" value="${Number(item.price||0)}"></label>
      <label class="edit-wide">Description<textarea data-field="description" rows="5">${escapeHtml(item.description||'')}</textarea></label>
      <label class="edit-check"><input data-field="acceptOffers" type="checkbox" ${item.acceptOffers?'checked':''}> Accept offers</label>
      <label class="edit-check"><input data-field="shipping" type="checkbox" ${item.shipping?'checked':''}> Shipping available</label>
      <label class="edit-check"><input data-field="pickup" type="checkbox" ${item.pickup?'checked':''}> Local pickup available</label>
      <label>Pickup area<input data-field="pickupArea" value="${escapeAttr(item.pickupArea||'')}"></label>
    </div>
    <div class="listing-actions">
      <button class="mini-btn edit" data-action="save-edit" data-id="${escapeHtml(item.id)}">Save Changes</button>
      <button class="mini-btn remove" data-action="cancel-edit" data-id="${escapeHtml(item.id)}">Cancel</button>
    </div>
  </div>`;
}

async function handleListingAction(event) {
  const action = event.currentTarget.dataset.action;
  const id = event.currentTarget.dataset.id;
  const user = auth.currentUser;
  if (!user || !id) return;
  const ref = doc(db, 'listings', id);
  const item = listingCache.get(id);

  try {
    if (action === 'sold') {
      if (!confirm('Mark this listing as sold? It will no longer appear as an active marketplace listing.')) return;
      await updateDoc(ref, { status: 'sold', soldAt: serverTimestamp() });
      status.textContent = 'Listing marked sold.';
      await loadMyListings(user.uid);
      return;
    }
    if (action === 'remove') {
      if (!confirm('Remove this listing? This permanently deletes it from Paws It On.')) return;
      await deleteDoc(ref);
      status.textContent = 'Listing removed.';
      await loadMyListings(user.uid);
      return;
    }
    if (action === 'edit') {
      if (!item) return;
      const card = event.currentTarget.closest('.seller-listing');
      card.querySelector('.listing-editor')?.remove();
      card.insertAdjacentHTML('beforeend', renderEditor(item));
      bindListingButtons();
      return;
    }
    if (action === 'cancel-edit') {
      event.currentTarget.closest('.listing-editor')?.remove();
      return;
    }
    if (action === 'save-edit') {
      const editor = event.currentTarget.closest('.listing-editor');
      const get = name => editor.querySelector(`[data-field="${name}"]`);
      const updates = {
        title: get('title').value.trim(),
        category: get('category').value,
        brand: get('brand').value.trim(),
        size: get('size').value.trim(),
        color: get('color').value.trim(),
        condition: get('condition').value,
        description: get('description').value.trim(),
        price: Number(get('price').value),
        acceptOffers: get('acceptOffers').checked,
        shipping: get('shipping').checked,
        pickup: get('pickup').checked,
        pickupArea: get('pickupArea').value.trim(),
        updatedAt: serverTimestamp()
      };
      if (!updates.title || !updates.category || !updates.condition || !updates.description || !updates.price) {
        status.textContent = 'Title, category, condition, description, and a valid price are required.';
        return;
      }
      await updateDoc(ref, updates);
      status.textContent = 'Listing updated.';
      await loadMyListings(user.uid);
    }
  } catch (e) {
    console.error(e);
    status.textContent = 'That listing could not be changed. We may need to adjust the Firestore rules.';
  }
}

function friendly(e){ const c=e?.code||''; if(c.includes('email-already-in-use')) return 'That email already has an account. Try Sign In.'; if(c.includes('invalid-credential')) return 'Email or password did not match.'; if(c.includes('weak-password')) return 'Use a password with at least 6 characters.'; return 'Could not complete that request. Please check the email and password and try again.'; }
function escapeHtml(s){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function escapeAttr(s){ return escapeHtml(s).replace(/`/g,'&#96;'); }
