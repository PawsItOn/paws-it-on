import { auth, db } from './firebase.js';
import { doc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

// Transaction-flow bridge for the Offers page.
// Accepted offers reserve the listing; payment/fulfillment is a separate next step.

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-offer-action="accept-counter"]');
  if (!button) return;

  // account.js currently handles this action without reserving the listing.
  // Intercept it here so both acceptance paths behave the same way.
  event.preventDefault();
  event.stopImmediatePropagation();

  const user = auth.currentUser;
  const offerId = button.dataset.offerId;
  if (!user || !offerId) return;

  const statusNode = document.getElementById('auth-status');
  const originalText = button.textContent;

  try {
    button.disabled = true;
    button.textContent = 'Accepting…';

    const offerRef = doc(db, 'offers', offerId);
    const offerSnap = await getDoc(offerRef);
    if (!offerSnap.exists()) throw new Error('Offer not found');

    const offer = offerSnap.data();
    if (offer.buyerId !== user.uid) throw new Error('Only the buyer can accept this counteroffer');
    if (offer.status !== 'countered') throw new Error('This counteroffer is no longer available');

    await updateDoc(offerRef, {
      status: 'accepted',
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    if (offer.listingId) {
      await updateDoc(doc(db, 'listings', offer.listingId), {
        status: 'pending',
        reservedForBuyerId: user.uid,
        acceptedOfferId: offerId,
        pendingAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    window.location.reload();
  } catch (error) {
    console.error(error);
    button.disabled = false;
    button.textContent = originalText;
    if (statusNode) statusNode.textContent = 'That counteroffer could not be accepted. Please refresh and try again.';
  }
}, true);

function decorateAcceptedOffers() {
  const myOffers = document.getElementById('my-offers-results');
  if (!myOffers) return;

  myOffers.querySelectorAll('.offer-card').forEach((card) => {
    const state = card.querySelector('.offer-state');
    if (!state || state.textContent.trim().toLowerCase() !== 'accepted') return;
    if (card.querySelector('.purchase-required')) return;

    const note = document.createElement('div');
    note.className = 'purchase-required';
    note.innerHTML = '<strong>Offer accepted — purchase required</strong><p>This item is reserved for you. Your next step will be choosing an available fulfillment method: local pickup or shipping. Payment/checkout is not live yet, so accepting an offer does not mark the item sold.</p>';
    card.appendChild(note);
  });
}

const observer = new MutationObserver(decorateAcceptedOffers);
const myOffers = document.getElementById('my-offers-results');
if (myOffers) {
  observer.observe(myOffers, { childList: true, subtree: true });
  decorateAcceptedOffers();
}
