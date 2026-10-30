/* SBM — خواندن سوپابیس و ادغام آن با content.json (مشترک بین سایت و پنل) */
(function(w){
'use strict';
var SBM={};
var TABLES=['site_settings','skills','projects','gallery_photos','site_music','blog_posts'];
function one(url,key,table,ms){
  var ctl=w.AbortController?new AbortController():null,t=setTimeout(function(){ctl&&ctl.abort()},ms||4000);
  return fetch(url.replace(/\/$/,'')+'/rest/v1/'+table+'?select=*',{headers:{apikey:key,Authorization:'Bearer '+key},signal:ctl&&ctl.signal})
    .then(function(r){clearTimeout(t);if(!r.ok)throw new Error(table+' '+r.status);return r.json()})
    .catch(function(){clearTimeout(t);return null});
}
/* همه جدول‌ها را می‌خواند؛ اگر هیچ‌کدام در دسترس نبود reject می‌شود */
SBM.fetchAll=function(url,key,ms,only){
  var list=only||TABLES;
  return Promise.all(list.map(function(t){return one(url,key,t,ms)})).then(function(r){
    var o={},ok=false;list.forEach(function(t,i){o[t]=r[i];if(r[i])ok=true});
    if(!ok)throw new Error('supabase unreachable');return o;
  });
};
function clone(x){return JSON.parse(JSON.stringify(x||{}))}
function sortBy(a,k){return (a||[]).slice().sort(function(x,y){return (x[k]||0)-(y[k]||0)})}
function low(s){return String(s||'').trim().toLowerCase()}
/* raw → content. mapUrl اختیاری: تابعی که آدرس فایل‌های سوپابیس را به مسیر گیت‌هاب تبدیل می‌کند */
SBM.merge=function(base,raw,mapUrl){
  var c=clone(base);mapUrl=mapUrl||function(u){return u};
  c.site=c.site||{};c.contact=c.contact||{};c.apps=c.apps||[];
  var S=c.site;S.name=S.name||{};S.tagline=S.tagline||{};S.about=S.about||{};
  var st=raw.site_settings&&raw.site_settings[0];
  if(st){
    if(st.name)S.name.fa=st.name;
    if(st.hero_desc||st.title)S.tagline.fa=st.hero_desc||st.title;
    if(st.about)S.about.fa=st.about;
    if(st.alias)S.alias=st.alias;
    S.stats=S.stats||[];
    [['projects_count','10+'],['experience','2'],['age','20']].forEach(function(p,i){
      if(st[p[0]]){S.stats[i]=S.stats[i]||{value:'',label:{fa:'',en:''}};S.stats[i].value=String(st[p[0]]);}
    });
    var C=c.contact;
    if(st.phone)C.phone=st.phone;if(st.contact_email)C.email=st.contact_email;
    if(st.instagram)C.instagram=st.instagram;if(st.telegram)C.telegram=st.telegram;if(st.github)C.github=st.github;
    if(st.about_video_url)S.about_video=st.about_video_url;
  }
  if(raw.skills&&raw.skills.length){c.skills=sortBy(raw.skills,'sort_order').map(function(s){return {name:s.name,level:+s.level||0,icon:s.icon_url?mapUrl(s.icon_url):''}})}
  if(raw.projects){
    var pub=sortBy(raw.projects.filter(function(p){return !p.status||p.status==='published'}),'sort_order');
    var old={};c.apps.forEach(function(a){old[low(a.name)]=a});
    var imported=pub.map(function(p){
      var prev=old[low(p.title)]||{},links=[];
      if(p.demo_url)links.push({label:{fa:'ورود به وب‌اپ',en:'Open web app'},url:p.demo_url});
      if(p.apk_url)links.push({label:{fa:'دانلود APK اندروید',en:'Download Android APK'},url:p.apk_url});
      return {name:p.title,src:'sb',sbid:p.id,subtitle:{fa:p.subtitle||'',en:(prev.subtitle&&prev.subtitle.en)||''},
        icon:p.icon_url?mapUrl(p.icon_url):(prev.icon||''),cover:p.cover_url?mapUrl(p.cover_url):(prev.cover||''),images:(p.images||[]).map(mapUrl),
        desc:{fa:p.description||'',en:(prev.desc&&prev.desc.en)||''},tech:p.technologies||[],links:links}
    });
    var names={};imported.forEach(function(a){names[low(a.name)]=1});
    var keep=c.apps.filter(function(a){return a.src!=='sb'&&!names[low(a.name)]});
    c.apps=imported.concat(keep);
  }
  if(raw.gallery_photos&&raw.gallery_photos.length)S.gallery=sortBy(raw.gallery_photos,'sort_order').map(function(p){return mapUrl(p.url)});
  var mu=raw.site_music&&raw.site_music[0];if(mu&&mu.url)S.music=mapUrl(mu.url);
  return c;
};
/* ---------- ترجمه‌ی خودکار فارسی → انگلیسی ---------- */
function hasFa(t){return /[\u0600-\u06FF]/.test(t||'')}
function chunks(t){var out=[],cur='';String(t).split(/(?<=[.!؟?\n۔])/).forEach(function(p){if((cur+p).length>380&&cur){out.push(cur);cur=p}else cur+=p});if(cur)out.push(cur);return out}
function tmo(p,ms){return Promise.race([p,new Promise(function(_,rej){setTimeout(function(){rej(new Error('timeout'))},ms)})])}
function gtx(q){return tmo(fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=fa&tl=en&dt=t&q='+encodeURIComponent(q)).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){return j[0].map(function(x){return x[0]}).join('')}),7000)}
function mym(q){return tmo(fetch('https://api.mymemory.translated.net/get?langpair=fa|en&q='+encodeURIComponent(q)).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){var t=j.responseData&&j.responseData.translatedText;if(!t||/MYMEMORY WARNING/i.test(t))throw 0;return t}),7000)}
SBM.translate=function(text){
  var parts=chunks(text),out=[];
  return parts.reduce(function(pr,p){return pr.then(function(){return gtx(p).catch(function(){return mym(p)}).then(function(t){out.push(t)})})},Promise.resolve()).then(function(){return out.join(' ').replace(/\s+/g,' ').trim()});
};
SBM.autoTranslate=function(c,log){
  log=log||function(){};c._tr=c._tr||{};var auto={};Object.keys(c._tr).forEach(function(k){auto[c._tr[k]]=1});
  var jobs=[],S=c.site||{};
  function add(o,k){if(o&&o[k]&&typeof o[k]==='object'&&hasFa(o[k].fa))jobs.push(o[k])}
  add(S,'tagline');add(S,'about');
  (c.apps||[]).forEach(function(a){add(a,'desc');add(a,'subtitle')});
  var used={},n=0,fail=0;
  return jobs.reduce(function(pr,o){return pr.then(function(){
    var fa=o.fa;used[fa]=1;var cur=o.en;if(cur&&!auto[cur])return;   /* ترجمه‌ی دستی را دست نمی‌زنیم */
    if(c._tr[fa]){o.en=c._tr[fa];return}
    return SBM.translate(fa).then(function(en){if(!en)throw 0;c._tr[fa]=en;o.en=en;n++;log('   ✓ ترجمه شد: '+fa.slice(0,28)+'…')}).catch(function(){fail++;log('   ✗ ترجمه‌ی خودکار در دسترس نبود: '+fa.slice(0,28)+'…')});
  })},Promise.resolve()).then(function(){Object.keys(c._tr).forEach(function(k){if(!used[k])delete c._tr[k]});return {done:n,failed:fail}});
};
w.SBM=SBM;
})(window);
