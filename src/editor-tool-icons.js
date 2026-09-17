(() => {
  const tools=[
    ['[data-tool="select"]','Select','Select, move, or resize an existing layer.','#83baff','M5 3l14 10-7 1-3 7z'],
    ['[data-tool="arrow"]','Arrow','Drag from the tail to the arrow tip; adjust color and thickness.','#ff9b75','M4 20 20 4M8 4h12v12'],
    ['[data-tool="marker"]','Circle marker','Draw a circle or ellipse around an area to mark it.','#9ddc83','M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0'],
    ['[data-tool="rect"]','Rectangle','Draw a colored rectangle annotation.','#ffbd80','M4 5h16v14H4z'],
    ['[data-tool="text"]','Text','Add a text annotation; adjust its size, rotation, and arc.','#e9cf74','M4 5h16M12 5v15M8 20h8M4 5v3M20 5v3'],
    ['[data-tool="crop"]','Crop','Drag over the image to define the crop. The original file is retained.','#87d8b5','M7 2v15h15M2 7h15v15'],
    ['[data-tool="blur"]','Blur region','Drag a region, then adjust blur strength. Not guaranteed secure redaction.','#bda4ff','M7 4a8 8 0 100 16M12 5v14M16 7v10M20 10v4'],
    ['[data-tool="pixelate"]','Pixelate region','Drag a region, then adjust pixel block strength. Not guaranteed secure redaction.','#ec9fd0','M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'],
    ['#run-ai-removal','Remove object','Remove the painted area with local AI.','#83dab3','M4 17 15 6l4 4L8 21H4zM4 4v5M1 6h6M19 1v5M16 3h6'],
    ['#clear-ai-mask','Clear mask','Erase the painted mask and start again.','#efac91','M3 14 13 4l8 8-9 9H9zM8 9l8 8M12 21h9'],
    ['#manage-ai-removal-plugin','Manage AI model','Open model setup, downloads and plugin settings.','#bba4ef','M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6'],
    ['#accept-ai-removal','Accept result','Apply this result and clear the painted mask.','#83dab3','M4 12l5 5L20 6'],
    ['#retry-ai-removal','Retry','Generate another result using the current mask.','#8ebcff','M20 7v5h-5M20 12a8 8 0 1 0-2 6'],
    ['#discard-ai-removal','Discard result','Keep the image and mask unchanged.','#f49aab','M6 6l12 12M6 18 18 6'],
    ['[data-tool="ai-remove"]','AI object removal','Paint over an object, then Remove object. Review and Accept or Discard the local AI result.','#91d8e9','M3 15L14 4l7 7-10 10H8zM9 9l7 7M15 21h7'],
    ['#remove-image-background','Remove Background','Remove the background of the saved image with local AI. Preview before accepting. First use downloads a verified 4.5 MB model.','#9bdf94','M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M12 7a3 3 0 110 6 3 3 0 010-6M7 18c0-5 10-5 10 0'],
    ['#rotate-left','Rotate left','Rotate the image 90° counterclockwise.','#83baff','M4 4v6h6M4 10a8 8 0 111 9'],
    ['#rotate-right','Rotate right','Rotate the image 90° clockwise.','#83baff','M20 4v6h-6M20 10a8 8 0 10-1 9'],
    ['#flip-image','Flip image','Mirror the image horizontally.','#87d8b5','M12 3v18M8 6L3 18h5zM16 6l5 12h-5z'],
    ['#edit-grayscale','Black and white','Toggle grayscale for the edited image.','#c5ceda','M12 3a9 9 0 100 18 9 9 0 000-18M12 3v18M8 5v14M5 8v8'],
    ['#edit-negative','Negative','Toggle inverted image colors.','#bda4ff','M12 3a9 9 0 100 18 9 9 0 000-18M7 12h10M12 7v10'],
    ['#edit-sepia','Sepia','Toggle a warm sepia effect.','#eac087','M12 3C8 9 5 12 5 16a7 7 0 0014 0c0-4-3-7-7-13z']
  ];
  const imageSection=document.querySelector('.editor-image-section');
  imageSection.after(document.querySelector('.editor-resize-controls'),document.querySelector('.ai-enlarge-controls'));
  const gridButton=document.querySelector('#editor-transparency-grid');
  gridButton.addEventListener('click',()=>{const enabled=document.querySelector('.annotation-canvas').classList.toggle('editor-checkerboard');gridButton.setAttribute('aria-pressed',String(enabled));document.dispatchEvent(new CustomEvent('pigeon-editor-grid',{detail:enabled}));});
  for(const heading of document.querySelectorAll('.annotation-toolbar h3')){
    const group=heading.parentElement;group.classList.add('editor-collapsible-group');heading.tabIndex=0;heading.setAttribute('role','button');heading.setAttribute('aria-expanded','true');heading.title='Double-click to collapse or expand; Enter or Space also works';
    const toggle=()=>heading.setAttribute('aria-expanded',String(!group.classList.toggle('editor-group-collapsed')));
    heading.addEventListener('dblclick',event=>{if(event.target.closest('input'))return;event.preventDefault();toggle();});
    heading.addEventListener('keydown',event=>{if(event.target!==heading||!['Enter',' '].includes(event.key))return;event.preventDefault();event.stopPropagation();toggle();});
  }
  for(const summary of document.querySelectorAll('.annotation-toolbar summary'))summary.addEventListener('click',event=>{if(event.detail>1)event.preventDefault();});
  for(const[selector,label,description,color,d]of tools){const button=document.querySelector(selector);if(!button)continue;button.classList.add('editor-tool-button');button.setAttribute('aria-label',label);button.setAttribute('aria-description',description);button.title=`${label} — ${description}`;button.style.setProperty('--tool-color',color);button.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;}
})();
