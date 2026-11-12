'use strict';
const path=require('node:path');
const {Worker}=require('node:worker_threads');
function installPortfolioManager({app,BrowserWindow,ipcMain,getMainWindow,listPortfolios,getActivePortfolioId,notify}){
  let manager=null;
  ipcMain.handle('portfolio:manager-open',()=>{
    if(manager&&!manager.isDestroyed()){manager.show();manager.focus();return true;}
    manager=new BrowserWindow({width:1080,height:880,minWidth:560,minHeight:560,title:'Portfolio Manager - Pigeon',backgroundColor:'#1b1e22',parent:getMainWindow(),autoHideMenuBar:true,show:false,webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
    manager.webContents.setWindowOpenHandler(()=>({action:'deny'}));manager.webContents.on('will-navigate',event=>event.preventDefault());manager.once('ready-to-show',()=>manager?.show());manager.on('closed',()=>{manager=null;});manager.loadFile(path.join(__dirname,'..','src','portfolio-manager.html'));return true;
  });
  ipcMain.handle('portfolio:manager-state',()=>{notify();return {portfolios:listPortfolios().map(({id,name})=>({id,name})),activePortfolioId:getActivePortfolioId(),edition:`Pigeon ${app.getVersion()} / Electron`};});
  const pending=new Map();
  ipcMain.handle('portfolio:statistics',(_event,id)=>{
    const portfolio=listPortfolios().find(p=>p.id===id);if(!portfolio)throw new Error('Portfolio not found');
    if(pending.has(id))return pending.get(id);
    if(pending.size>=2)throw new Error('Statistics are busy. Please refresh in a moment.');
    const promise=new Promise((resolve,reject)=>{
      const worker=new Worker(path.join(__dirname,'portfolio-statistics-worker.js'),{workerData:{database:portfolio.database}});
      const timer=setTimeout(()=>{worker.terminate();reject(new Error('Statistics timed out. Please refresh.'));},30000);
      worker.once('message',result=>{clearTimeout(timer);if(result.error)reject(new Error(result.error));else resolve(result.value);});worker.once('error',()=>{clearTimeout(timer);reject(new Error('Statistics worker could not read this portfolio.'));});worker.once('exit',code=>{clearTimeout(timer);if(code!==0)reject(new Error('Statistics worker stopped.'));});
    }).finally(()=>pending.delete(id));pending.set(id,promise);return promise;
  });
}
module.exports={installPortfolioManager};
