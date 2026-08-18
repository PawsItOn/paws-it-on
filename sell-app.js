import { auth, db, storage } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { collection, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js';

const MAX_PHOTOS = 8;
const MAX_BYTES = 5 * 1024 * 1024;
let currentUser = null;

onAuthStateChanged(auth, user => {
  currentUser = user;
  const s = document.getElementById('seller-auth-status');
  if (s) s.innerHTML = user
    ? `Signed in as <strong>${escapeHtml(user.email || 'Paws It On member')}</strong>.`
    : `You must <a href="account.html">sign in or create an account</a> before publishing.`;
});

const photosInput = document.getElementById('photos');
photosInput?.addEventListener('change', () => {
  const status = document.getElementById('listing-status');
  const files = [...photosInput.files];
  if (files.length > MAX_PHOTOS) {
    photosInput.value = '';
    status.textContent = `Please choose no more than ${MAX_PHOTOS} photos.`;
    return;
  }
  const bad = files.find(f => !f.type.startsWith('image/') || f.size >= MAX_BYTES);
  if (bad) {
    photosInput.value = '';
    status.textContent = 'Each photo must be an image smaller than 5 MB.';
    return;
  }
  if (files.length) status.textContent = `${files.length} photo${files.length === 1 ? '' : 's'} ready to upload.`;
});

document.getElementById('publish-listing')?.addEventListener('click', async () => {
  const status = document.getElementById('listing-status');
  if (!currentUser) { status.textContent = 'Please sign in first.'; return; }

  const title = document.getElementById('item-title').value.trim();
  const category = document.getElementById('category').value;
  const condition = document.getElementById('condition').value;
  const description = document.getElementById('description').value.trim();
  const price = Number(document.getElementById('price').value);
  const certified = document.getElementById('seller-certification').checked;
  const files = [...(photosInput?.files || [])];

  if (!title || !category || !condition || !description || !price) {
    status.textContent = 'Please complete title, category, condition, description, and price.'; return;
  }
  if (!certified) { status.textContent = 'Please confirm the seller certification before publishing.'; return; }
  if (!files.length) { status.textContent = 'Please add at least one real photo of the item.'; return; }
  if (files.length > MAX_PHOTOS) { status.textContent = `Please choose no more than ${MAX_PHOTOS} photos.`; return; }
  if (files.some(f => !f.type.startsWith('image/') || f.size >= MAX_BYTES)) {
    status.textContent = 'Each photo must be an image smaller than 5 MB.'; return;
  }

  try {
    const listingRef = doc(collection(db, 'listings'));
    const imageUrls = [];
    const imagePaths = [];
    status.textContent = `Uploading ${files.length} photo${files.length === 1 ? '' : 's'}…`;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `listing-images/${currentUser.uid}/${listingRef.id}/${Date.now()}-${i}-${safeName}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type });
      imageUrls.push(await getDownloadURL(storageRef));
      imagePaths.push(path);
      status.textContent = `Uploaded ${i + 1} of ${files.length} photos…`;
    }

    status.textContent = 'Saving listing…';
    await setDoc(listingRef, {
      sellerId: currentUser.uid,
      sellerEmail: currentUser.email || '',
      sellerType: 'community',
      title, category,
      brand: document.getElementById('brand').value.trim(),
      size: document.getElementById('size').value.trim(),
      color: document.getElementById('color').value.trim(),
      condition, description, price,
      acceptOffers: document.getElementById('accept-offers').checked,
      shipping: document.getElementById('shipping').checked,
      pickup: document.getElementById('pickup').checked,
      pickupArea: document.getElementById('pickup-area').value.trim(),
      sellerCertified: true,
      sellerCertifiedAt: serverTimestamp(),
      certificationVersion: '2026-08-17-v1',
      status: 'active',
      createdAt: serverTimestamp(),
      imageUrl: imageUrls[0],
      imageUrls,
      imagePaths
    });
    status.innerHTML = 'Listing and photos published! <a href="shop.html#listings">View it in the Shop →</a>';
    photosInput.value = '';
  } catch (e) {
    console.error(e);
    status.textContent = `Photo/listing upload failed: ${friendlyStorageError(e)}`;
  }
});

function friendlyStorageError(e) {
  const code = e?.code || '';
  if (code.includes('unauthorized')) return 'Firebase Storage did not allow the upload. Please make sure you are signed in and the Storage rules are published.';
  if (code.includes('quota')) return 'Storage quota was reached.';
  if (code.includes('canceled')) return 'Upload was canceled.';
  return 'please try again. If it keeps happening, we will check Firebase together.';
}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
