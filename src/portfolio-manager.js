(async()=>{
  'use strict';
  const $=selector=>document.querySelector(selector),format=number=>Math.max(0,Number(number)||0).toLocaleString();
  const S=window.PigeonPortfolioStatistics;
  let api,model={portfolios:[]},selected=null,statistics=null,generation=0,busy=false;
  const status=(text,error=false)=>{$('#manager-status').textContent=text;$('#manager-status').classList.toggle('error',error);};
  function bytes(value){const units=['B','KB','MB','GB','TB','PB'];let i=0;while(value>=1024&&i<units.length-1){value/=1024;i++;}return `${value.toLocaleString(undefined,{maximumFractionDigits:i?1:0})} ${units[i]}`;}
  function list(){
    const query=$('#portfolio-search').value.trim().toLowerCase(),container=$('#portfolio-list');container.replaceChildren();
    for(const portfolio of model.portfolios.filter(p=>p.name.toLowerCase().includes(query))){
      const button=document.createElement('button');button.className='portfolio-item';button.dataset.id=portfolio.id;button.setAttribute('aria-current',String(portfolio.id===selected));
      const name=document.createElement('strong');name.textContent=portfolio.name;const detail=document.createElement('small');detail.textContent=portfolio.id===model.activePortfolioId?'CURRENTLY OPEN':'PORTFOLIO';const text=document.createElement('span');text.append(name,detail);button.innerHTML=window.pigeonIcon('portfolio');button.append(text);button.onclick=()=>select(portfolio.id);container.append(button);
    }
    if(!container.children.length){const text=document.createElement('p');text.textContent='No matching portfolios.';container.append(text);}
  }
  function chart(){
    if(!statistics)return;
    const year=Number($('#activity-year').value),days=S.calendar(statistics.activity||{},year),maximum=Math.max(1,...days.filter(d=>!d.outside).map(d=>d.count));
    const heatmap=$('#heatmap');heatmap.replaceChildren();
    for(const day of days){const cell=document.createElement('span');cell.className=day.outside?'outside':'';cell.dataset.level=day.count?String(Math.min(4,Math.max(1,Math.ceil(day.count/maximum*4)))):'0';cell.title=`${day.date}: ${format(day.count)} files indexed`;heatmap.append(cell);}
    const total=days.filter(d=>!d.outside).reduce((sum,d)=>sum+d.count,0),active=days.filter(d=>!d.outside&&d.count>0).length;
    $('#activity-summary').textContent=`${format(total)} files indexed across ${format(active)} days in ${year}`;
    heatmap.setAttribute('aria-label',$('#activity-summary').textContent);
  }
  function renderStats(){
    const stats=statistics;$('#file-count').textContent=format(stats.totalFiles);$('#total-size').textContent=bytes(stats.totalBytes);$('#source-count').textContent=format(stats.locations);$('#collection-count').textContent=format(stats.collections);$('#pie-count').textContent=format(stats.totalFiles);
    const years=stats.years?.length?stats.years:[new Date().getUTCFullYear()];const yearSelect=$('#activity-year');yearSelect.replaceChildren(...years.map(year=>new Option(String(year),String(year))));chart();
    let angle=0;const stops=[],legend=$('#type-legend');legend.replaceChildren();
    for(const type of stats.byType){const share=stats.totalFiles?type.count/stats.totalFiles*100:0,color=S.TYPES.find(t=>t[0]===type.type)?.[2]||'#87949e';if(type.count){stops.push(`${color} ${angle}% ${angle+share}%`);angle+=share;}
      const row=document.createElement('tr'),label=document.createElement('td'),dot=document.createElement('i');dot.style.background=color;label.append(dot,document.createTextNode(type.label));const count=document.createElement('td');count.textContent=format(type.count);const percent=document.createElement('td');percent.textContent=`${share.toLocaleString(undefined,{maximumFractionDigits:1})}%`;row.append(label,count,percent);legend.append(row);
    }
    $('#type-pie').style.background=stops.length?`conic-gradient(${stops.join(',')})`:'#36413c';$('#type-pie').setAttribute('aria-label',`File count by type: ${stats.byType.filter(t=>t.count).map(t=>`${t.label} ${format(t.count)}`).join(', ')||'no indexed files'}`);
    $('#privacy-note').textContent=stats.protected?'Password-protected content and Trash are excluded from these charts. Folder passwords are never removed.':'Trash is excluded. Source files remain where they are.';
  }
  async function select(id){
    selected=id;statistics=null;const ticket=++generation,portfolio=model.portfolios.find(p=>p.id===id);list();
    $('#portfolio-name').textContent=portfolio?.name||'No portfolio selected';$('#portfolio-state').textContent=id===model.activePortfolioId?'Currently open in the main window':'An independent reference library';$('#open-portfolio').textContent=id===model.activePortfolioId?'Return to portfolio':'Open portfolio';$('#remove-portfolio').disabled=!id||id===model.activePortfolioId||model.portfolios.length<=1;
    $('#portfolio-detail').setAttribute('aria-busy','true');status('Reading portfolio statistics...');
    for(const selector of ['#file-count','#total-size','#source-count','#collection-count'])$(selector).textContent='--';
    $('#heatmap').replaceChildren();$('#activity-summary').textContent='Reading activity...';$('#type-legend').replaceChildren();$('#pie-count').textContent='--';$('#type-pie').style.background='#36413c';
    if(!id){status('Create or add a portfolio to get started.');return;}
    try{const stats=await api.getPortfolioStatistics(id);if(ticket!==generation)return;statistics=stats;renderStats();status('');}catch(error){if(ticket===generation)status(error.message,true);}finally{if(ticket===generation)$('#portfolio-detail').setAttribute('aria-busy','false');}
  }
  async function refresh(preferred=selected){model=await api.getPortfolioManagerState();$('#edition').textContent=model.edition||'Pigeon';document.title=`Portfolio Manager - ${model.edition||'Pigeon'}`;await select(model.portfolios.some(p=>p.id===preferred)?preferred:model.activePortfolioId||model.portfolios[0]?.id);}
  function prompt(title,message,value=null,confirm='Continue'){
    return new Promise(resolve=>{const dialog=$('#portfolio-prompt');$('#prompt-title').textContent=title;$('#prompt-message').textContent=message;$('#prompt-label').hidden=value===null;$('#prompt-name').value=value||'';$('#prompt-name').required=value!==null;$('#prompt-confirm').textContent=confirm;dialog.returnValue='';dialog.addEventListener('close',()=>resolve(dialog.returnValue==='confirm'?(value===null?true:$('#prompt-name').value.trim()):null),{once:true});dialog.showModal();(value===null?$('#prompt-confirm'):$('#prompt-name')).focus();});
  }
  async function operation(work){if(busy)return;busy=true;const buttons=[...document.querySelectorAll('button')];const disabled=buttons.map(button=>button.disabled);buttons.forEach(button=>button.disabled=true);try{await work();}catch(error){status(error.message,true);}finally{busy=false;buttons.forEach((button,i)=>{if(button.isConnected)button.disabled=disabled[i];});$('#remove-portfolio').disabled=!selected||selected===model.activePortfolioId||model.portfolios.length<=1;}}
  for(const [id,icon] of [['create-portfolio','portfolio'],['add-existing','folder-open'],['refresh','refresh'],['rename-portfolio','edit'],['remove-portfolio','trash'],['open-portfolio','folder-open']]){const button=$(`#${id}`);button.insertAdjacentHTML('afterbegin',window.pigeonIcon(icon));}
  $('#portfolio-search').oninput=list;$('#activity-year').onchange=chart;
  $('#refresh').onclick=()=>operation(()=>refresh());$('#close-manager').onclick=()=>api?.closeWindow();
  $('#create-portfolio').onclick=async()=>{const name=await prompt('New portfolio','Create an independent portfolio for a project or collection.','','Create portfolio');if(!name)return;await operation(async()=>{status('Creating portfolio...');const p=await api.createPortfolio(name);await refresh(p.id);});};
  $('#add-existing').onclick=()=>operation(async()=>{status('Choose a portfolio database. Large portfolios can take a little time to import.');const p=await api.addExistingPortfolio();if(p)await refresh(p.id);else status('No portfolio added.');});
  $('#rename-portfolio').onclick=async()=>{const p=model.portfolios.find(p=>p.id===selected);if(!p)return;const name=await prompt('Rename portfolio','Choose a name that makes this library easy to find.',p.name,'Rename');if(!name)return;await operation(async()=>{await api.renamePortfolio(p.id,name);await refresh(p.id);});};
  $('#remove-portfolio').onclick=async()=>{const p=model.portfolios.find(p=>p.id===selected);if(!p||p.id===model.activePortfolioId)return;const yes=await prompt('Remove this portfolio?',`Remove "${p.name}" from the portfolio list? Its indexed metadata may be removed. Original media files will not be deleted.`,null,'Remove portfolio');if(!yes)return;await operation(async()=>{await api.removePortfolio(p.id);await refresh(model.activePortfolioId);});};
  $('#open-portfolio').onclick=()=>operation(async()=>{if(!selected)return;status('Opening portfolio...');if(selected!==model.activePortfolioId)await api.switchPortfolio(selected);await api.closeWindow();});
  try{api=await window.PigeonPortfolioHost.ready;await refresh();}catch(error){status(error.message,true);}
})();
