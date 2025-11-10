const LS = {
  VERIFIED_USER: 'otp_demo_verified_user',
  ACCESS_LOGS: 'otp_demo_access_logs',
  LAST_OTP: 'otp_demo_last_otp', // { code, phone, email, name, expiresAt, tries, resent }
};

export function saveVerifiedUser(user){
  localStorage.setItem(LS.VERIFIED_USER, JSON.stringify(user));
}
export function getVerifiedUser(){
  try { return JSON.parse(localStorage.getItem(LS.VERIFIED_USER) || 'null'); } catch { return null; }
}
export function clearVerifiedUser(){
  localStorage.removeItem(LS.VERIFIED_USER);
}

export function appendAccessLog(entry){
  const logs = getAccessLogs();
  logs.push(entry);
  localStorage.setItem(LS.ACCESS_LOGS, JSON.stringify(logs));
}
export function getAccessLogs(){
  try { return JSON.parse(localStorage.getItem(LS.ACCESS_LOGS) || '[]'); } catch { return []; }
}
export function exportLogsAsJson(){
  const blob = new Blob([JSON.stringify(getAccessLogs(), null, 2)], {type:'application/json'});
  return URL.createObjectURL(blob);
}
export function exportLogsAsCsv(){
  const rows = getAccessLogs();
  if(!rows.length){ return URL.createObjectURL(new Blob([''], {type:'text/csv'})); }
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
  return URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
}

export function saveOtpState(obj){ localStorage.setItem(LS.LAST_OTP, JSON.stringify(obj)); }
export function getOtpState(){ try { return JSON.parse(localStorage.getItem(LS.LAST_OTP) || 'null'); } catch { return null; } }
export function clearOtpState(){ localStorage.removeItem(LS.LAST_OTP); }

export function uniqueUserKey(email, phone){
  return `${(email||'').toLowerCase()}|${(phone||'')}`;
}
