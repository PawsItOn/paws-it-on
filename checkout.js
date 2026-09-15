import {auth,db} from './firebase.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import {doc,getDoc,updateDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
const params=new URLSearchParams(location.search),offerId=params.get('offer');
const form=document.getElementById('shipping-form'),status=document.getElementById('checkout-status'),button=document.getElementById('continue-btn'),paymentBox=document.getElementById('payment-test'),paymentBtn=document.getElementById('test-payment-btn'),paymentStatus=document.getElementById('payment-status');
let currentOffer=null;
const SELLER_FEE_RATE=.08;
const money=n=>`$${Number(n||0).toFixed(2)}`;

function shippingSummary(o){
  const type=o?.shippingType||'';
  if(type==='free') return {label:'Free shipping',amount:0,display:'$0.00',ready:true,note:'The seller is covering the shipping cost.'};
  if(type==='flat'){
    const amount=Number(o.flatShippingPrice||0);
    return {label:'Flat-rate shipping',amount,display:money(amount),ready:true,note:'The seller set a flat shipping charge for this item.'};
  }
  if(type==='calculated') return {label:'Calculated shipping',amount:0,display:'Calculated after address',ready:false,note:'A live carrier rate will be calculated from your address before real payment is connected.'};
  return {label:'Shipping',amount:0,display:'Calculated later',ready:false,note:'Shipping pricing has not been finalized for this order yet.'};
}

function renderSummary(o){
  if(!o)return;
  const itemPrice=Number(o.counterAmount||o.amount||0);
  const shipping=shippingSummary(o);
  const buyerTotal=itemPrice+(shipping.ready?shipping.amount:0);
  document.getElementById('item-title').textContent=o.listingTitle||'Your purchase';
  document.getElementById('item-price').textContent=money(itemPrice);
  document.getElementById('shipping-type-label').textContent=shipping.label;
  document.getElementById('shipping-price').textContent=shipping.display;
  document.getElementById('marketplace-fee').textContent='$0.00';
  document.getElementById('subtotal').textContent=money(buyerTotal);
  document.getElementById('summary-note').textContent=shipping.ready
    ? `${shipping.note} The 8% Paws It On marketplace fee is paid by the seller, not added to your purchase total.`
    : `${shipping.note} The current total does not include the future calculated shipping charge. The 8% seller fee is not charged to you.`;
}

function showPaymentState(o){if(!o)return;if(o.checkoutStage==='paid_test'||o.paymentStatus==='paid_test'){paymentBox.hidden=false;paymentBtn.disabled=true;paymentBtn.textContent='Test Payment Complete';paymentStatus.textContent='📣 Test payment successful. The seller can now prepare this order for shipping.';return;}if(o.shippingAddress||o.checkoutStage==='awaiting_payment'){paymentBox.hidden=false;paymentBtn.disabled=false;paymentBtn.textContent='Run Test Payment';paymentStatus.textContent='';}}
onAuthStateChanged(auth,async user=>{if(!user){status.textContent='Please sign in to continue checkout.';button.disabled=true;return;}if(!offerId){status.textContent='This checkout link is missing its offer number.';button.disabled=true;return;}try{const snap=await getDoc(doc(db,'offers',offerId));if(!snap.exists())throw new Error('Offer not found');const o={id:snap.id,...snap.data()};if(o.buyerId!==user.uid||o.status!=='accepted'||o.fulfillmentMethod!=='shipping')throw new Error('Checkout is not available for this offer');currentOffer=o;renderSummary(o);if(o.shippingAddress){document.getElementById('ship-name').value=o.shippingAddress.fullName||'';document.getElementById('ship-street').value=o.shippingAddress.street||'';document.getElementById('ship-unit').value=o.shippingAddress.unit||'';document.getElementById('ship-city').value=o.shippingAddress.city||'';document.getElementById('ship-state').value=o.shippingAddress.state||'';document.getElementById('ship-zip').value=o.shippingAddress.zip||'';}showPaymentState(o);}catch(e){console.error(e);status.textContent='This shipping checkout is not available.';button.disabled=true;}});
form.addEventListener('submit',async e=>{e.preventDefault();const user=auth.currentUser;if(!user||!currentOffer)return;button.disabled=true;button.textContent='Saving…';status.textContent='';const address={fullName:document.getElementById('ship-name').value.trim(),street:document.getElementById('ship-street').value.trim(),unit:document.getElementById('ship-unit').value.trim(),city:document.getElementById('ship-city').value.trim(),state:document.getElementById('ship-state').value.trim().toUpperCase(),zip:document.getElementById('ship-zip').value.trim()};try{await updateDoc(doc(db,'offers',offerId),{shippingAddress:address,checkoutStage:'awaiting_payment',shippingAddressSavedAt:serverTimestamp(),updatedAt:serverTimestamp()});currentOffer={...currentOffer,shippingAddress:address,checkoutStage:'awaiting_payment'};status.textContent='🐾 Shipping address saved! Run the test payment below.';button.textContent='Shipping Saved';showPaymentState(currentOffer);}catch(err){console.error(err);status.textContent='Shipping could not be saved yet.';button.disabled=false;button.textContent='Save Shipping & Continue';}});
paymentBtn.addEventListener('click',async()=>{const user=auth.currentUser;if(!user||!currentOffer||!currentOffer.shippingAddress)return;paymentBtn.disabled=true;paymentBtn.textContent='Processing Test Payment…';paymentStatus.textContent='';try{const itemPrice=Number(currentOffer.counterAmount||currentOffer.amount||0),sellerFee=Number((itemPrice*SELLER_FEE_RATE).toFixed(2)),sellerProceeds=Number((itemPrice-sellerFee).toFixed(2));await updateDoc(doc(db,'offers',offerId),{paymentStatus:'paid_test',checkoutStage:'paid_test',sellerFeeRate:SELLER_FEE_RATE,sellerFee,sellerProceeds,testPaidAt:serverTimestamp(),updatedAt:serverTimestamp()});currentOffer={...currentOffer,paymentStatus:'paid_test',checkoutStage:'paid_test',sellerFeeRate:SELLER_FEE_RATE,sellerFee,sellerProceeds};showPaymentState(currentOffer);}catch(err){console.error(err);paymentStatus.textContent='Test payment could not be recorded yet.';paymentBtn.disabled=false;paymentBtn.textContent='Run Test Payment';}});