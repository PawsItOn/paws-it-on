import { auth } from './firebase.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';

const email = document.getElementById('email');
const password = document.getElementById('password');
const status = document.getElementById('auth-status');
const form = document.getElementById('auth-form');
const signedInBox = document.getElementById('signed-in-box');
const signOutBtn = document.getElementById('sign-out');
const intro = document.getElementById('account-intro');

function showSignedIn(user) {
  form.hidden = true;
  form.style.setProperty('display', 'none', 'important');
  signedInBox.hidden = false;
  signedInBox.style.display = 'block';
  signOutBtn.hidden = false;
  signOutBtn.style.display = 'inline-flex';
  intro.textContent = 'Welcome back. Manage your Paws It On account and listings here.';
  signedInBox.innerHTML = `<strong>Signed in as ${escapeHtml(user.email || 'Paws It On member')}</strong><br><a href="sell.html">Create a listing →</a>`;
}

function showSignedOut() {
  signedInBox.hidden = true;
  signedInBox.style.display = 'none';
  signOutBtn.hidden = true;
  signOutBtn.style.display = 'none';
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

onAuthStateChanged(auth, user => {
  if (user) showSignedIn(user);
  else showSignedOut();
});

function friendly(e){ const c=e?.code||''; if(c.includes('email-already-in-use')) return 'That email already has an account. Try Sign In.'; if(c.includes('invalid-credential')) return 'Email or password did not match.'; if(c.includes('weak-password')) return 'Use a password with at least 6 characters.'; return 'Could not complete that request. Please check the email and password and try again.'; }
function escapeHtml(s){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
