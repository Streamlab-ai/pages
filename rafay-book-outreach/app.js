'use strict';
const $ = id => document.getElementById(id);
let campaign, currentId, version = '', refreshing = false;
const text = (id, value) => { $(id).textContent = value || ''; };
function node(tag, value, className) { const e = document.createElement(tag); if(value !== undefined) e.textContent=value; if(className)e.className=className; return e; }
function safeUrl(value) { try { const u = new URL(value); return ['https:','mailto:'].includes(u.protocol) ? u.href : '#'; } catch { return '#'; } }
function formatDate(value, detailed = false) { return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Manila',...(detailed?{hour:'numeric',minute:'2-digit',hour12:true}:{})}).format(new Date(value)); }
function link(label, url) { const a = node('a',label+' ↗'); a.href=safeUrl(url); a.target='_blank';a.rel='noopener noreferrer';return a; }
async function refresh(manual=false) {
 if(refreshing)return; refreshing=true; $('refresh').disabled=true;
 try {
  const response=await fetch('campaign.json?t='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const raw=await response.text(), data=JSON.parse(raw);
  if(!Array.isArray(data.prospects)||!data.updatedAt||!Array.isArray(data.decisions)||!Array.isArray(data.activity))throw new Error('Invalid campaign data');
  if(raw!==version){ campaign=data;version=raw;render();if(currentId&&$('prospect-dialog').open)showProspect(currentId,false); }
  text('load-status',manual?'Latest published data loaded.':'');
 } catch(e) { text('load-status', campaign?'Update check failed. Showing the last successfully loaded data. Please try Refresh.':'Campaign data could not load. Please try Refresh.'); }
 finally {refreshing=false;$('refresh').disabled=false;}
}
function render(){
 const p=campaign.prospects;
 text('updated','Updated '+formatDate(campaign.updatedAt,true)+' PHT');
 $('book-link').href=safeUrl(campaign.bookUrl);
 renderBaseline();
 const values=[['Researched',p.length,'Prospects in this batch'],['Drafts ready',p.filter(x=>x.stage==='Draft ready').length,'Prepared for review'],['Messages sent',p.filter(x=>x.sentAt).length,'Recorded outreach'],['Positive replies',p.filter(x=>x.response?.type==='positive').length,'Confirmed interest'],['Opportunities',p.filter(x=>x.outcome).length,'Accepted or published'],['Published',p.filter(x=>x.outcome?.type==='published'&&x.outcomeUrl).length,'With an evidence link']];
 $('metrics').replaceChildren(...values.map(([label,value,note])=>{const e=node('div',undefined,'metric');e.append(node('p',label,'metric-label'),node('p',String(value),'metric-number'),node('p',note,'metric-note'));return e;}));
 text('metric-note',campaign.metricNote);text('methodology',campaign.methodology);
 const selected=$('channel').value;$('channel').replaceChildren(new Option('All channels','all'),...[...new Set(p.map(x=>x.channel))].map(x=>new Option(x,x)));if([...$('channel').options].some(x=>x.value===selected))$('channel').value=selected;
 $('decisions').replaceChildren(...campaign.decisions.map((d,i)=>{const row=node('div',undefined,'decision'),body=node('div');body.append(node('h3',d.title),node('p',d.body));row.append(node('span',String(i+1).padStart(2,'0'),'decision-index'),body);return row;}));
 $('activity-items').replaceChildren(...campaign.activity.map(d=>{const row=node('article',undefined,'activity-item'),date=node('time',formatDate(d.date+'T12:00:00Z')+' · '+d.kind);date.dateTime=d.date;row.append(date,node('h3',d.title),node('p',d.detail));return row;}));
 renderRows();
}
function renderBaseline(){
 const baseline=campaign.bookBaselines?.[0];
 $('book-baseline').hidden=!baseline;
 if(!baseline)return;
 text('baseline-date','Observed '+formatDate(baseline.observedAt,true)+' PHT · '+baseline.platform);
 $('baseline-values').replaceChildren();
 const rating=node('div'),total=node('div');
 rating.append(node('strong',baseline.rating.toFixed(1)+' / '+baseline.ratingScale),node('span','Average rating'));
 total.append(node('strong',String(baseline.globalRatings)),node('span','Global ratings'));
 $('baseline-values').append(rating,total);
 $('amazon-link').href=safeUrl(campaign.amazonUrl||baseline.sourceUrl);
 $('amazon-reviews-link').href=safeUrl(baseline.reviewPageUrl);
 $('baseline-stars').replaceChildren(...[5,4,3,2,1].map(star=>{
  const value=baseline.starPercentages[String(star)],row=node('div',undefined,'star-row'),track=node('div',undefined,'star-track'),fill=node('div',undefined,'star-fill');
  track.setAttribute('aria-hidden','true');fill.style.width=Math.max(0,Math.min(100,value))+'%';track.append(fill);row.append(node('span',star+' star'),track,node('span',value+'%'));return row;
 }));
 text('baseline-note',baseline.note);
}
function renderRows(){
 if(!campaign)return;
 const query=$('search').value.toLowerCase().trim(), wave=$('wave').value,channel=$('channel').value;
 const rows=campaign.prospects.filter(p=>(wave==='all'||String(p.wave)===wave)&&(channel==='all'||p.channel===channel)&&[p.name,p.person,p.channel,p.angle,p.fit].join(' ').toLowerCase().includes(query));
 text('result-count',rows.length+' of '+campaign.prospects.length+' prospects');
 $('prospect-rows').replaceChildren(...rows.map(p=>{
  const tr=node('tr'),name=node('td'),angle=node('td',p.angle,'angle'),wave=node('td'),status=node('td'),action=node('td');
  name.append(node('p',p.name,'prospect-name'),node('p',p.channel,'channel-label'));wave.append(node('span',p.wave===1?'01 · First':'02 · Reserve','wave '+(p.wave===1?'first':'')));status.append(node('span',p.stage,'pill'));
  const button=node('button','View →','open-draft');button.type='button';button.setAttribute('aria-label','View '+p.name+' draft');button.onclick=()=>showProspect(p.id);action.append(button);tr.append(name,angle,wave,status,action);return tr;
 }));$('empty').hidden=rows.length>0;
}
function showProspect(id,open=true){
 const p=campaign.prospects.find(x=>x.id===id);if(!p)return;currentId=id;
 text('dialog-title',p.name);text('dialog-channel',p.channel+' / '+(p.wave===1?'FIRST WAVE':'RESERVE'));
 const details=node('div');details.append(node('span',p.stage,'pill'));if(p.sentAt)details.append(node('p','Sent '+formatDate(p.sentAt)));if(p.followUpOn)details.append(node('p','Follow-up due '+formatDate(p.followUpOn)));
 $('dialog-status').replaceChildren(details);text('dialog-fit',p.fit);text('dialog-evidence',p.evidence);text('dialog-person',p.person);text('dialog-contact',p.contactLabel);$('dialog-contact').href=safeUrl(p.contactUrl);
 $('dialog-sources').replaceChildren(...p.sources.map(s=>link(s.label,s.url)));
 text('dialog-needs',p.needs);text('dialog-follow-up',p.followUp);text('dialog-subject',p.subject);text('dialog-message',p.message);text('copy-status','');
 const outcome=$('dialog-outcome');outcome.replaceChildren();if(p.response){outcome.append(node('h3','Recorded reply'),node('p',p.response.summary));}if(p.outcome){outcome.append(node('h3','Confirmed opportunity'),node('p',p.outcome.summary));if(p.outcomeUrl)outcome.append(link('View evidence',p.outcomeUrl));}
 if(open){$('prospect-dialog').showModal();$('close-dialog').focus();}
}
$('close-dialog').onclick=()=>$('prospect-dialog').close();
$('prospect-dialog').addEventListener('click',e=>{if(e.target===$('prospect-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('copy-message').onclick=async()=>{const p=campaign.prospects.find(x=>x.id===currentId);try{await navigator.clipboard.writeText('Subject: '+p.subject+'\n\n'+p.message);text('copy-status','Copied subject and draft. Nothing has been sent.');}catch{const range=document.createRange();range.selectNodeContents($('dialog-message'));window.getSelection().removeAllRanges();window.getSelection().addRange(range);text('copy-status','Clipboard unavailable. Draft selected; use your device’s Copy command.');}};
['search','wave','channel'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',renderRows));
$('clear').onclick=()=>{$('search').value='';$('wave').value='all';$('channel').value='all';renderRows();};
$('show-first').onclick=()=>{$('search').value='';$('channel').value='all';$('wave').value='1';renderRows();$('prospects').scrollIntoView();$('wave').focus({preventScroll:true});};
$('refresh').onclick=()=>refresh(true);
$('export').onclick=()=>{if(!campaign)return;const clean=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';const fields=['Prospect','Channel','Wave','Status','Contact','Contact URL','Angle','Subject','Draft','Before sending','Sent at','Follow-up due','Outcome URL','Sources'];const rows=campaign.prospects.map(p=>[p.name,p.channel,p.wave,p.stage,p.contactLabel,p.contactUrl,p.angle,p.subject,p.message,p.needs,p.sentAt,p.followUpOn,p.outcomeUrl,p.sources.map(s=>s.url).join(' | ')]);const blob=new Blob(['\ufeff'+[fields,...rows].map(row=>row.map(clean).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=node('a');a.href=url;a.download='web-hacking-arsenal-outreach.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){document.querySelectorAll('.sidebar nav a').forEach(a=>a.classList.toggle('active',a.hash==='#'+e.target.id));}},{rootMargin:'-8% 0px -65% 0px',threshold:0});
['overview','prospects','next-steps','activity'].forEach(id=>observer.observe($(id)));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh();});
window.addEventListener('focus',()=>refresh());setInterval(()=>{if(document.visibilityState==='visible')refresh();},60000);refresh();
