import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

let currentUser = null;
onAuthStateChanged(auth, user => {
  currentUser = user;
  const s = document.getElementById('seller-auth-status');
  if (s) s.innerHTML = user
    ? `Signed in as <strong>${user.email}</strong>.`
    : `You must <a href="account.html">sign in or create an account</a> before publishing.`;
});

document.getElementById('publish-listing')?.addEventListener('click', async () => {
  const status = document.getElementById('listing-status');
  if (!currentUser) {
    status.textContent = 'Please sign in first.';
    return;
  }

  const title = document.getElementById('item-title').value.trim();
  const category = document.getElementById('category').value;
  const condition = document.getElementById('condition').value;
  const description = document.getElementById('description').value.trim();
  const price = Number(document.getElementById('price').value);
  const certified = document.getElementById('seller-certification').checked;

  if (!title || !category || !condition || !description || !price) {
    status.textContent = 'Please complete title, category, condition, description, and price.';
    return;
  }

  if (!certified) {
    status.textContent = 'Please confirm the seller certification before publishing.';
    return;
  }

  try {
    status.textContent = 'Publishing…';
    await addDoc(collection(db, 'listings'), {
      sellerId: currentUser.uid,
      sellerEmail: currentUser.email || '',
      sellerType: 'community',
      title,
      category,
      brand: document.getElementById('brand').value.trim(),
      size: document.getElementById('size').value.trim(),
      color: document.getElementById('color').value.trim(),
      condition,
      description,
      price,
      acceptOffers: document.getElementById('accept-offers').checked,
      shipping: document.getElementById('shipping').checked,
      pickup: document.getElementById('pickup').checked,
      pickupArea: document.getElementById('pickup-area').value.trim(),
      sellerCertified: true,
      sellerCertifiedAt: serverTimestamp(),
      certificationVersion: '2026-08-17-v1',
      status: 'active',
      createdAt: serverTimestamp(),
      imageUrl: ''
    });
    status.innerHTML = 'Listing published! <a href="shop.html#listings">View it in the Shop →</a>';
  } catch (e) {
    console.error(e);
    status.textContent = 'Firebase did not allow the listing. We may need to update the Firestore security rules.';
  }
});
