/* Vault — رمزگذاری توکن گیت‌هاب با نام‌کاربری و رمز (AES-256-GCM + PBKDF2-SHA256، ۶۰۰ هزار تکرار) */
(function(w){
'use strict';
var enc=new TextEncoder(),dec=new TextDecoder(),C=(w.crypto||globalThis.crypto);
function b2s(buf){var a=new Uint8Array(buf),s='';for(var i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);return btoa(s)}
function s2b(s){var b=atob(s),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
function key(user,pass,salt,iter){
  return C.subtle.importKey('raw',enc.encode(String(user).trim().toLowerCase()+'\u0000'+pass),'PBKDF2',false,['deriveKey']).then(function(km){
    return C.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:iter,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])});
}
var Vault={
  create:function(user,pass,payload){
    var salt=C.getRandomValues(new Uint8Array(16)),iv=C.getRandomValues(new Uint8Array(12)),iter=600000;
    return key(user,pass,salt,iter).then(function(k){return C.subtle.encrypt({name:'AES-GCM',iv:iv},k,enc.encode(JSON.stringify(payload)))})
      .then(function(ct){return {v:1,kdf:'PBKDF2-SHA256',iter:iter,salt:b2s(salt),iv:b2s(iv),ct:b2s(ct)}});
  },
  open:function(user,pass,v){
    return key(user,pass,s2b(v.salt),v.iter).then(function(k){return C.subtle.decrypt({name:'AES-GCM',iv:s2b(v.iv)},k,s2b(v.ct))})
      .then(function(pt){return JSON.parse(dec.decode(pt))},function(){throw new Error('نام کاربری یا رمز عبور اشتباه است')});
  }
};
w.Vault=Vault;
})(typeof window!=='undefined'?window:globalThis);
