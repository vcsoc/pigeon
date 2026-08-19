'use strict';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function startupModifierPowerShell() {
  return `$signature='[DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key);';Add-Type -MemberDefinition $signature -Name PigeonStartupKeys -Namespace Native -ErrorAction SilentlyContinue;$control=([Native.PigeonStartupKeys]::GetAsyncKeyState(0x11)-band 0x8000)-ne 0;if($control){'1'}else{'0'}`;
}

function portfolioChooserHtml(portfolios, activePortfolioId) {
  const rows = portfolios.map((portfolio, index) => `<button type="button" data-portfolio-id="${escapeHtml(portfolio.id)}"${portfolio.id === activePortfolioId ? ' class="active"' : ''}${index === 0 ? ' autofocus' : ''}><span>${escapeHtml(portfolio.name)}</span>${portfolio.id === activePortfolioId ? '<small>Current</small>' : ''}</button>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'"><title>Choose a portfolio · Pigeon</title><style>*{box-sizing:border-box}html,body{margin:0;height:100%;font:13px "Segoe UI",sans-serif;background:#191b1f;color:#eef1f5}body{display:grid;grid-template-rows:auto minmax(0,1fr) auto}header{padding:18px 18px 13px;border-bottom:1px solid #343840;background:#202329}h1{margin:0 0 5px;font-size:17px}p{margin:0;color:#929aa8;font-size:11px;line-height:1.45}.list{overflow:auto;padding:10px;display:grid;align-content:start;gap:5px}.list button{min-height:43px;padding:7px 10px;border:1px solid #3b414b;border-radius:7px;background:#272b31;color:#e6e9ee;display:flex;align-items:center;justify-content:space-between;text-align:left}.list button:hover,.list button:focus,.list button.active{outline:0;border-color:#7097e7;background:#30394a}.list small{color:#91ace3}footer{padding:10px 13px;border-top:1px solid #343840;color:#7f8794;font-size:10px}</style></head><body><header><h1>Choose a portfolio</h1><p>Select a portfolio before Pigeon opens. This can bypass a portfolio that cannot be loaded.</p></header><main class="list">${rows}</main><footer>Enter opens the focused portfolio · Esc cancels startup</footer><script>const buttons=[...document.querySelectorAll('[data-portfolio-id]')];function choose(button){location.href='pigeon-portfolio-choice://select/'+encodeURIComponent(button.dataset.portfolioId)}for(const button of buttons)button.addEventListener('click',()=>choose(button));addEventListener('keydown',(event)=>{const index=Math.max(0,buttons.indexOf(document.activeElement));if(event.key==='Escape'){location.href='pigeon-portfolio-choice://cancel';event.preventDefault()}else if(event.key==='Enter'&&document.activeElement?.dataset.portfolioId){choose(document.activeElement);event.preventDefault()}else if(event.key==='ArrowDown'||event.key==='ArrowUp'){buttons[(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();event.preventDefault()}})</script></body></html>`;
}

module.exports = { portfolioChooserHtml, startupModifierPowerShell };
