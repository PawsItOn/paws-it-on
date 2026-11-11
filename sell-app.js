import { auth, db, storage } from './firebase.js';
import { prepareListingPhotos } from './image-utils.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { collection, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js';

const MAX_PHOTOS = 8;
let currentUser = null;

onAuthStateChanged(auth, user => {
  currentUser = user;
  const s = document.getElementById('seller-auth-status');
  if (s) s.innerHTML = user
    ? `Signed in as <strong>${escapeHtml(user.email || 'Paws It On member')}</strong>.`
    : `You must <a href="account.html">sign in or create an account</a> before publishing.`;
});

const photosInput = document.getElementById('photos');
const shippingInput = document.getElementById('shipping');
const shippingOptions = document.getElementById('shipping-options');
const shippingType = document.getElementById('shipping-type');
const flatWrap = document.getElementById('flat-shipping-wrap');
const calculatedWrap = document.getElementById('calculated-shipping-wrap');

function refreshShippingFields(){
  const enabled = !!shippingInput?.checked;
  if (shippingOptions) shippingOptions.hidden = !enabled;
  const type = enabled ? shippingType?.value : '';
  if (flatWrap) flatWrap.hidden = type !== 'flat';
  if (calculatedWrap) calculatedWrap.hidden = type !== 'calculated';
}
shippingInput?.addEventListener('change', refreshShippingFields);
shippingType?.addEventListener('change', refreshShippingFields);
refreshShippingFields();

photosInput?.addEventListener('change', () => {
  const status = document.getElementById('listing-status');
  const files = [...photosInput.files];
  if (files.length > MAX_PHOTOS) {
    photosInput.value = '';
    status.textContent = `Please choose no more than ${MAX_PHOTOS} photos.`;
    return;
  }
  if (files.length) status.textContent = `${files.length} photo${files.length === 1 ? '' : 's'} selected. Large phone photos will be resized automatically when you publish.`;
});


const listingForm = document.getElementById('listing-form');
function clearFieldErrors() {
  listingForm?.querySelectorAll('.field-invalid').forEach(el => {
    el.classList.remove('field-invalid');
    el.removeAttribute('aria-invalid');
  });
  listingForm?.querySelectorAll('.field-error-message').forEach(el => el.remove());
}
function markField(id, message) {
  const field = document.getElementById(id);
  if (!field) return;
  const target = field.type === 'file' ? field.closest('.photo-upload') || field : field;
  target.classList.add('field-invalid');
  field.setAttribute('aria-invalid', 'true');
  const note = document.createElement('span');
  note.className = 'field-error-message';
  note.setAttribute('role', 'alert');
  note.textContent = message;
  const parent = field.closest('label') || field.parentElement;
  parent.insertAdjacentElement('afterend', note);
}
listingForm?.addEventListener('input', event => {
  const field = event.target;
  if (field.classList.contains('field-invalid') || field.getAttribute('aria-invalid') === 'true') {
    field.classList.remove('field-invalid');
    field.removeAttribute('aria-invalid');
    const note = (field.closest('label') || field.parentElement)?.nextElementSibling;
    if (note?.classList.contains('field-error-message')) note.remove();
  }
});
listingForm?.addEventListener('change', event => {
  const field = event.target;
  if (field.getAttribute('aria-invalid') === 'true') {
    field.removeAttribute('aria-invalid');
    field.classList.remove('field-invalid');
    field.closest('.photo-upload')?.classList.remove('field-invalid');
    const note = (field.closest('label') || field.parentElement)?.nextElementSibling;
    if (note?.classList.contains('field-error-message')) note.remove();
  }
});
function validateListingFields() {
  clearFieldErrors();
  const errors = [];
  const requireField = (id, valid, message) => { if (!valid) errors.push([id, message]); };
  const val = id => document.getElementById(id)?.value.trim() || '';
  requireField('photos', !!photosInput?.files.length && photosInput.files.length <= MAX_PHOTOS, 'Add 1–8 item photos.');
  requireField('item-title', !!val('item-title'), 'Enter an item title.');
  requireField('category', !!val('category'), 'Choose a category.');
  requireField('condition', !!val('condition'), 'Choose the item condition.');
  requireField('description', !!val('description'), 'Describe the item.');
  requireField('price', val('price') !== '' && Number(val('price')) > 0, 'Enter a price greater than $0.');
  const shipping = !!shippingInput?.checked, pickup = !!document.getElementById('pickup')?.checked;
  if (!shipping && !pickup) {
    errors.push(['shipping', 'Select shipping or local pickup.']);
    errors.push(['pickup', 'Select shipping or local pickup.']);
  }
  if (shipping) {
    const type = val('shipping-type');
    requireField('shipping-type', !!type, 'Choose a shipping method.');
    if (type === 'flat') requireField('flat-shipping-price', val('flat-shipping-price') !== '' && Number(val('flat-shipping-price')) >= 0, 'Enter a valid shipping charge.');
    if (type === 'calculated') for (const id of ['package-weight','package-length','package-width','package-height']) {
      requireField(id, val(id) !== '' && Number(val(id)) > 0, 'Enter a value greater than zero.');
    }
  }
  requireField('seller-certification', !!document.getElementById('seller-certification')?.checked, 'Confirm the seller certification.');
  for (const [id, message] of errors) markField(id, message);
  if (errors.length) {
    const first = document.getElementById(errors[0][0]);
    (first?.closest('.photo-upload') || first)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    first?.focus({ preventScroll: true });
  }
  return errors.length;
}

document.getElementById('publish-listing')?.addEventListener('click', async () => {
  const status = document.getElementById('listing-status');
  if (!currentUser) { status.innerHTML = 'Please <a href="account.html">sign in or create an account</a> first.'; return; }
  const errorCount = validateListingFields();
  if (errorCount) { status.textContent = `Please complete the ${errorCount} highlighted field${errorCount === 1 ? '' : 's'} before publishing.`; return; }

  const title = document.getElementById('item-title').value.trim();
  const category = document.getElementById('category').value;
  const condition = document.getElementById('condition').value;
  const description = document.getElementById('description').value.trim();
  const price = Number(document.getElementById('price').value);
  const certified = document.getElementById('seller-certification').checked;
  const selectedFiles = [...(photosInput?.files || [])];
  const shipping = !!shippingInput?.checked;
  const pickup = document.getElementById('pickup').checked;
  const shipType = shipping ? shippingType?.value || '' : '';
  const flatShippingPrice = shipType === 'flat' ? Number(document.getElementById('flat-shipping-price').value) : null;
  const packageWeight = shipType === 'calculated' ? Number(document.getElementById('package-weight').value) : null;
  const packageLength = shipType === 'calculated' ? Number(document.getElementById('package-length').value) : null;
  const packageWidth = shipType === 'calculated' ? Number(document.getElementById('package-width').value) : null;
  const packageHeight = shipType === 'calculated' ? Number(document.getElementById('package-height').value) : null;

  if (!title || !category || !condition || !description || !price) {
    status.textContent = 'Please complete title, category, condition, description, and price.'; return;
  }
  if (!shipping && !pickup) { status.textContent = 'Please choose shipping, local pickup, or both.'; return; }
  if (shipping && !shipType) { status.textContent = 'Please choose calculated, flat-rate, or free shipping.'; return; }
  if (shipType === 'flat' && (!Number.isFinite(flatShippingPrice) || flatShippingPrice < 0)) { status.textContent = 'Please enter a valid flat shipping charge.'; return; }
  if (shipType === 'calculated' && (![packageWeight, packageLength, packageWidth, packageHeight].every(v => Number.isFinite(v) && v > 0))) { status.textContent = 'For calculated shipping, please enter package weight, length, width, and height.'; return; }
  if (!certified) { status.textContent = 'Please confirm the seller certification before publishing.'; return; }
  if (!selectedFiles.length) { status.textContent = 'Please add at least one real photo of the item.'; return; }
  if (selectedFiles.length > MAX_PHOTOS) { status.textContent = `Please choose no more than ${MAX_PHOTOS} photos.`; return; }

  try {
    status.textContent = 'Preparing photos…';
    const files = await prepareListingPhotos(selectedFiles);
    const listingRef = doc(collection(db, 'listings'));
    const imageUrls = [];
    const imagePaths = [];
    status.textContent = `Uploading ${files.length} photo${files.length === 1 ? '' : 's'}…`;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const safeName = (file.name || `photo-${i}.jpg`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `listing-images/${currentUser.uid}/${listingRef.id}/${Date.now()}-${i}-${safeName}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type || 'image/jpeg' });
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
      shipping,
      shippingType: shipType,
      flatShippingPrice: shipType === 'flat' ? flatShippingPrice : null,
      packageWeight: shipType === 'calculated' ? packageWeight : null,
      packageLength: shipType === 'calculated' ? packageLength : null,
      packageWidth: shipType === 'calculated' ? packageWidth : null,
      packageHeight: shipType === 'calculated' ? packageHeight : null,
      pickup,
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
  if (e?.message === 'too-large') return 'that photo is unusually large and could not be resized. Try choosing a screenshot or a different copy of the photo.';
  if (e?.message === 'not-image') return 'one of the selected files is not an image.';
  const code = e?.code || '';
  if (code.includes('unauthorized')) return 'Firebase Storage did not allow the upload. Please make sure you are signed in and the Storage rules are published.';
  if (code.includes('quota')) return 'Storage quota was reached.';
  if (code.includes('canceled')) return 'Upload was canceled.';
  return 'please try again. If it keeps happening, we will check Firebase together.';
}
function escapeHtml(s){return String(s).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
