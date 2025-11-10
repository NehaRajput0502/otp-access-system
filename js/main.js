import { sanitize, isValidEmail, isValidName, isValidPhone } from './validation.js';
import { saveVerifiedUser, getVerifiedUser, appendAccessLog, uniqueUserKey } from './storage.js';
import { startOtpFlow, verifyOtp, resendOtp, startResendCountdown } from './otp.js';

// Helpers
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function setYear(){ const y=$('#year'); if(y) y.textContent = new Date().getFullYear(); }

function lockUI(locked){
  $$('.card').forEach(c => c.classList.toggle('locked', locked));
  const note = document.querySelector('.locked-note');
  if(note){ note.style.display = locked ? '' : 'none'; }
}
function getCurrentPageId(){ return location.pathname.split('/').pop() || 'index.html'; }

// Intl tel optional init (won’t break if CDN blocked)
function initIntlTel(input){
  try {
    if (window.intlTelInput) {
      window.intlTelInput(input, {
        initialCountry: 'in',
        utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@23.7.3/build/js/utils.js'
      });
    }
  } catch (_) {}
}
function e164FromIntlTel(input){
  // If the intl-tel-input plugin is available, try its E.164 first
  try {
    if (window.intlTelInputGlobals) {
      const inst = window.intlTelInputGlobals.getInstance(input);
      if (inst) {
        // 1) If plugin says it's valid, return E.164
        if (inst.isValidNumber()) return inst.getNumber();

        // 2) If user typed national format (no +), build E.164 using selected country
        const raw = String(input.value || '').replace(/\D/g, ''); // digits only
        const sel = inst.getSelectedCountryData(); // {dialCode: '91', ...}
        if (sel && raw) {
          // If raw already starts with dialCode (e.g., 9198...), keep as-is; else prepend
          const withCc = raw.startsWith(sel.dialCode) ? raw : sel.dialCode + raw;
          return '+' + withCc;
        }
      }
    }
  } catch (_) {}

  // Fallback (no plugin): try to detect +, else assume India (+91) for convenience
  const v = String(input.value || '').trim();
  if (/^\+/.test(v)) return v.replace(/\s+/g, '');
  // Assume India as default country if none provided (you can change this)
  const digits = v.replace(/\D/g, '');
  if (digits) return '+91' + digits;
  return v;
}


function showModal(id){
  const el = $(id);
  el.classList.remove('hidden');
  el.setAttribute('aria-hidden','false');
  const firstInput = el.querySelector('input');
  firstInput && firstInput.focus();
}
function hideModal(id){
  const el = $(id);
  el.classList.add('hidden');
  el.setAttribute('aria-hidden','true');
}

// Register Modal Logic
function initRegisterModal(){
  const accessBtn = $('#accessBtn');
  const closeRegister = $('#closeRegister');
  const cancelRegister = $('#cancelRegister');
  const form = $('#registerForm');
  const spinner = $('#registerSpinner');
  const phoneInput = $('#phone');
  const emailInput = $('#email');

  // Make sure intl tel input doesn't break anything if CDN blocked
  if (phoneInput) initIntlTel(phoneInput);

  // If JS is working, prefer JS click (over inline fallback)
  accessBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    showModal('#registerModal');
  });

  [closeRegister, cancelRegister].forEach(btn => btn?.addEventListener('click', () => hideModal('#registerModal')));

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    $$('.error').forEach(e => e.textContent='');

    const name = sanitize($('#name').value);
    const email = sanitize(emailInput.value).toLowerCase();
    const phone = e164FromIntlTel(phoneInput);

    let ok = true;
    if(!isValidName(name)){ $('[data-for="name"]').textContent = 'Please enter your full name.'; ok=false; }
    if(!isValidEmail(email)){ $('[data-for="email"]').textContent = 'Please enter a valid email.'; ok=false; }
    if(!isValidPhone(phone)){ $('[data-for="phone"]').textContent = 'Enter a valid phone with country code (e.g., +91...).'; ok=false; }
    if(!ok) return;

    spinner.hidden = false;
    setTimeout(() => {
      try{
        const state = startOtpFlow({name, email, phone});
        $('#otpPhoneLabel').textContent = `${state.phone}`;
        hideModal('#registerModal');
        showModal('#otpModal');

        // start resend countdown
        $('#resendOtp').disabled = true;
        startResendCountdown(
          (sec)=> $('#resendTimer').textContent = `Resend in ${sec}s`,
          ()=> { $('#resendTimer').textContent = ''; $('#resendOtp').disabled = false; }
        );
      }catch(err){
        alert(err.message || 'Failed to start OTP.');
      }finally{
        spinner.hidden = true;
      }
    }, 500);
  });
}

// OTP Modal Logic
function initOtpModal(){
  const inputs = $$('#otpInputs input');
  const verifyBtn = $('#verifyOtp');
  const closeOtp = $('#closeOtp');
  const editDetails = $('#editDetails');
  const resendBtn = $('#resendOtp');
  const spinner = $('#otpSpinner');

  // auto-focus & move
  inputs.forEach((inp, idx) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g,'');
      if(inp.value && idx < inputs.length -1) inputs[idx+1].focus();
      const code = inputs.map(i=>i.value).join('');
      if(code.length === 6) verifyBtn.click(); // auto-submit when 6 entered
    });
    inp.addEventListener('keydown', (e) => {
      if(e.key === 'Backspace' && !inp.value && idx>0) inputs[idx-1].focus();
    });
  });

  function readCode(){ return inputs.map(i=>i.value).join(''); }
  function clearCode(){ inputs.forEach(i=>i.value=''); inputs[0].focus(); }

  closeOtp?.addEventListener('click', () => hideModal('#otpModal'));
  editDetails?.addEventListener('click', () => { hideModal('#otpModal'); showModal('#registerModal'); });

  resendBtn?.addEventListener('click', () => {
    resendBtn.disabled = true;
    startResendCountdown(
      (sec)=> $('#resendTimer').textContent = `Resend in ${sec}s`,
      ()=> { $('#resendTimer').textContent = ''; $('#resendOtp').disabled = false; }
    );
    try{
      resendOtp();
    }catch(err){
      alert(err.message || 'Resend failed.');
      resendBtn.disabled = false;
    }
  });

  verifyBtn?.addEventListener('click', () => {
    const code = readCode();
    if(code.length !== 6){
      $('[data-for="otp"]').textContent = 'Enter the 6-digit code.';
      return;
    }
    $('[data-for="otp"]').textContent = '';
    spinner.hidden = false;

    setTimeout(() => {
      const res = verifyOtp(code);
      spinner.hidden = true;
      if(!res.ok){
        let msg = 'Invalid code. Try again.';
        if(res.reason === 'expired') msg = 'OTP expired. Press “Resend OTP”.';
        if(res.reason === 'too_many_attempts') msg = 'Too many attempts. Resend a fresh OTP.';
        $('[data-for="otp"]').textContent = msg;
        clearCode();
        return;
      }
      // success
      saveVerifiedUser(res.user);
      hideModal('#otpModal');
      onVerified(res.user);
    }, 400);
  });
}

function onVerified(user){
  // Unlock UI
  lockUI(false);
  const note = document.querySelector('.locked-note'); if(note) note.remove();

  // Welcome message
  const hero = document.querySelector('.hero-text');
  const p = document.createElement('p');
  p.className = 'welcome';
  p.textContent = `Welcome, ${user.name}! Full access granted.`;
  hero.appendChild(p);

  // Log access
  appendAccessLog({
    name: user.name,
    email: user.email,
    phone: user.phone,
    accessedAt: new Date().toISOString(),
    content: getCurrentPageId(),
    ip: '' // you can fill via a server/IP API when you add a backend
  });
}

function restoreIfVerified(){
  const v = getVerifiedUser();
  if(v){ lockUI(false); } else { lockUI(true); }
}

function initPrivacyNotice(){
  $('#privacyLink')?.addEventListener('click', (e)=>{
    e.preventDefault();
    alert('We store your name, email, and phone in your browser (localStorage) with access logs. For production, host a backend and comply with GDPR/CCPA.');
  });
}

function init(){
  setYear();
  restoreIfVerified();
  initRegisterModal();
  initOtpModal();
  initPrivacyNotice();
}
document.addEventListener('DOMContentLoaded', init);
