import { saveOtpState, getOtpState, clearOtpState } from './storage.js';

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_SECONDS = 60;
const MAX_TRIES = 5;
const RATE_LIMIT_SECONDS = 30;

let resendCountdown = RESEND_SECONDS;
let resendTimerId = null;
let lastRequestAt = 0;

export function generateOtp(){
  return Math.floor(100000 + Math.random() * 900000).toString();
}
export function startOtpFlow({name, email, phone}){
  const now = Date.now();
  if (now - lastRequestAt < RATE_LIMIT_SECONDS * 1000) {
    throw new Error(`Please wait ${RATE_LIMIT_SECONDS}s before requesting another OTP.`);
  }
  lastRequestAt = now;

  const code = generateOtp();
  const expiresAt = Date.now() + OTP_TTL_MS;
  const state = { code, name, email, phone, expiresAt, tries: 0, resent: 0 };
  saveOtpState(state);

  console.log('[DEMO OTP]', code);
  alert(`DEMO OTP: ${code}`);
  return state;
}
export function resendOtp(){
  const state = getOtpState();
  if(!state) throw new Error('No OTP session found.');
  const newCode = generateOtp();
  const newState = { ...state, code: newCode, expiresAt: Date.now() + OTP_TTL_MS, resent: (state.resent||0)+1, tries: 0 };
  saveOtpState(newState);
  console.log('[DEMO OTP - RESEND]', newCode);
  alert(`DEMO OTP (Resent): ${newCode}`);
  return newState;
}
export function verifyOtp(entered){
  const state = getOtpState();
  if(!state) return { ok:false, reason:'no_state' };
  if(Date.now() > state.expiresAt) return { ok:false, reason:'expired' };

  const tries = (state.tries || 0) + 1;
  state.tries = tries;
  saveOtpState(state);

  if(tries > MAX_TRIES) return { ok:false, reason:'too_many_attempts' };
  if(entered === state.code) {
    const payload = { name: state.name, email: state.email, phone: state.phone, verifiedAt: new Date().toISOString() };
    clearOtpState();
    return { ok:true, user: payload };
  }
  return { ok:false, reason:'mismatch', remaining: MAX_TRIES - tries };
}

export function startResendCountdown(cbTick, cbDone){
  clearInterval(resendTimerId);
  resendCountdown = RESEND_SECONDS;
  cbTick(resendCountdown);
  resendTimerId = setInterval(() => {
    resendCountdown--;
    cbTick(resendCountdown);
    if(resendCountdown <= 0){
      clearInterval(resendTimerId);
      cbDone();
    }
  }, 1000);
}
