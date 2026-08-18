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
      results.innerHTML = '<div class="empty-listings"><strong>No listings yet.</strong><p>When you publish gear, it will appear here so you can manage it.</p></div>';
      return;
    }
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    items.sort((a,b) => ((b.createdAt?.seconds||0) - (a.createdAt?.seconds||0)));
    results.innerHTML = items.map(item => renderListing(item)).join('');
    results.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', handleListingAction));
  } catch (e) {
    console.error(e);
    results.innerHTML = '<div class="empty-listings">We could not load your listings yet. The Firestore rules may need one small update.</div>';
  }
}

function renderListing(item) {
  const delivery = [item.shipping ? 'Shipping' : '', item.pickup ? 'Local pickup' : ''].filter(Boolean).join(' · ') || 'Delivery not set';
  return `<article class="seller-listing" data-id="${escapeHtml(item.id)}">
    <span class="listing-state">${escapeHtml(item.status || 'active')}</span>
    <h3>${escapeHtml(item.title || 'Untitled listing')}</h3>
    <p class="listing-meta"><strong>$${Number(item.price || 0).toFixed(2)}</strong> · ${escapeHtml(item.condition || '')}</p>
    <p class="listing-meta">${escapeHtml(item.category || '')} · ${escapeHtml(delivery)}</p>
    <p>${escapeHtml(item.description || '')}</p>
    <div class="listing-actions">
      <button class="mini-btn edit" data-action="edit" data-id="${escapeHtml(item.id)}">Edit</button>
      <button class="mini-btn sold" data-action="sold" data-id="${escapeHtml(item.id)}">Mark Sold</button>
      <button class="mini-btn remove" data-action="remove" data-id="${escapeHtml(item.id)}">Remove Listing</button>
    </div>
  </article>`;
}

async function handleListingAction(event) {
  const action = event.currentTarget.dataset.action;
  const id = event.currentTarget.dataset.id;
  const user = auth.currentUser;
  if (!user || !id) return;
  const ref = doc(db, 'listings', id);

  try {
    if (action === 'sold') {
      if (!confirm('Mark this listing as sold? It will no longer appear as an active marketplace listing.')) return;
      await updateDoc(ref, { status: 'sold', soldAt: serverTimestamp() });
      status.textContent = 'Listing marked sold.';
    }
    if (action === 'remove') {
      if (!confirm('Remove this listing? This permanently deletes it from Paws It On.')) return;
      await deleteDoc(ref);
      status.textContent = 'Listing removed.';
    }
    if (action === 'edit') {
      const card = event.currentTarget.closest('.seller-listing');
      const currentTitle = card.querySelector('h3')?.textContent || '';
      const currentDescription = card.querySelector('p:last-of-type')?.textContent || '';
      const newTitle = prompt('Edit item title:', currentTitle);
      if (newTitle === null) return;
      const newPriceRaw = prompt('Edit price (numbers only):');
      if (newPriceRaw === null) return;
      const newDescription = prompt('Edit description:', currentDescription);
      if (newDescription === null) return;
      const newPrice = Number(newPriceRaw);
      if (!newTitle.trim() || !newDescription.trim() || !newPrice) {
        alert('Title, description, and a valid price are required.');
        return;
      }
      await updateDoc(ref, { title: newTitle.trim(), description: newDescription.trim(), price: newPrice, updatedAt: serverTimestamp() });
      status.textContent = 'Listing updated.';
    }
    await loadMyListings(user.uid);
  } catch (e) {
    console.error(e);
    status.textContent = 'That listing could not be changed. We may need to adjust the Firestore rules.';
  }
}

function friendly(e){ const c=e?.code||''; if(c.includes('email-already-in-use')) return 'That email already has an account. Try Sign In.'; if(c.includes('invalid-credential')) return 'Email or password did not match.'; if(c.includes('weak-password')) return 'Use a password with at least 6 characters.'; return 'Could not complete that request. Please check the email and password and try again.'; }
function escapeHtml(s){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
