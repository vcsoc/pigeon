const test = require('node:test');
const assert = require('node:assert/strict');
const { Worker } = require('node:worker_threads');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function simplePdf() {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>','<< /Length 39 >>\nstream\nBT /F1 24 Tf 45 105 Td (Pigeon PDF) Tj ET\nendstream','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']; let pdf = '%PDF-1.4\n', offsets = [0]; objects.forEach((object,index)=>{ offsets.push(Buffer.byteLength(pdf)); pdf += `${index+1} 0 obj\n${object}\nendobj\n`; }); const xref = Buffer.byteLength(pdf); pdf += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map((value)=>String(value).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer << /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return pdf;
}

test('PDF thumbnail worker rasterizes the first page', async () => { const directory = fs.mkdtempSync(path.join(os.tmpdir(),'pigeon-pdf-')), source = path.join(directory,'sample.pdf'), target = path.join(directory,'sample.jpg'); fs.writeFileSync(source,simplePdf()); const result = await new Promise((resolve,reject)=>{ const worker = new Worker(path.join(__dirname,'..','electron','pdf-thumbnail-worker.js'),{workerData:{source,target}}); worker.once('message',resolve); worker.once('error',reject); }); assert.equal(result.ok,true,result.message); assert.ok(fs.statSync(target).size > 100); fs.rmSync(directory,{recursive:true,force:true}); });
