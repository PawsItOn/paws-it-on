import { auth } from './firebase.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';

const email = document.getElementById('email');
const password = document.getElementById('password');
const status = document.getElementById('auth-status');
const form = document.getElementById('auth-form');
const signedInBox = document.getElementById('signed-in-box');
const signOutBtn = document.getElementById('sign-out');

document.getElementById('create-account').addEventListener('click', async () => {
  try { await createUserWithEmailAndPassword(auth, email.value.trim(), password.value); status.textContent='Account created. You are signed in.'; }
  catch (e) { status.textContent = friendly(e); }
});
document.getElementById('sign-in').addEventListener('click', async () => {
  try { await signInWithEmailAndPassword(auth, email.value.trim(), password.value); status.textContent='Signed in.'; }
  catch (e) { status.textContent = friendly(e); }
});
signOutBtn.addEventListener('click', async()=>{ await signOut(auth); status.textContent='Signed out.'; });

onAuthStateChanged(auth, user => {
  if(user){ form.hidden=true; signedInBox.hidden=false; signOutBtn.hidden=false; signedInBox.innerHTML=`<strong>Signed in as ${escapeHtml(user.email || 'Paws It On member')}</strong><br><a href="sell.html">Create a listing →</a>`; }
  else { form.hidden=false; signedInBox.hidden=true; signOutBtn.hidden=true; }
});
function friendly(e){ const c=e?.code||''; if(c.includes('email-already-in-use')) return 'That email already has an account. Try Sign In.'; if(c.includes('invalid-credential')) return 'Email or password did not match.'; if(c.includes('weak-password')) return 'Use a password with at least 6 characters.'; return 'Could not complete that request. Please check the email and password and try again.'; }
function escapeHtml(s){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
