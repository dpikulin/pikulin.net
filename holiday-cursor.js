/* Seasonal cursors: deterministic Eastern-time slots, no network requests or storage. */
(() => {
  'use strict';
  const zone = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', hourCycle: 'h23'
  });
  const christmas = ['santa','elf','reindeer','snowman','snowflake'];
  const newYear = ['popper','fireworks','clock','sparkles','ball','toast'];
  const root = document.documentElement;
  const fine = matchMedia('(any-pointer: fine)');
  const cache = new Map();
  let previous = '';
  let style;
  function selection(now) {
    const p = Object.fromEntries(zone.formatToParts(now).map(({type,value}) => [type,value]));
    const date = p.year + '-' + p.month + '-' + p.day;
    const day = Date.UTC(+p.year, +p.month - 1, +p.day);
    const slot = Math.floor(+p.hour / 4);
    const elapsed = start => Math.round((day - Date.parse(start + 'T00:00:00Z')) / 86400000) * 6 + slot;
    if (date >= '2026-11-27' && date <= '2026-12-30') return christmas[elapsed('2026-11-27') % christmas.length];
    if (date >= '2026-12-31' && date <= '2027-01-01') return newYear[(elapsed('2026-12-31') + (date === '2027-01-01' ? 3 : 0)) % newYear.length];
    return '';
  }
  // 40x40 raster cursor with an accurate arrow hotspot at (1,1).
  function artwork(id) {
    if (cache.has(id)) return cache.get(id);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 40;
    const c = canvas.getContext('2d');
    if (!c) return '';
    const oval = (x,y,rx,ry,fill,stroke='#273343',w=1) => {
      c.beginPath(); c.ellipse(x,y,rx,ry,0,0,Math.PI*2);
      c.fillStyle=fill; c.fill(); if(stroke){c.strokeStyle=stroke;c.lineWidth=w;c.stroke();}
    };
    const line = (pts,color,width=2) => {
      c.beginPath(); pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
      c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();
    };
    const poly = (pts,fill,stroke='#273343') => {
      c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
      c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}
    };
    const emoji = glyph => {
      c.font='27px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      c.textAlign='center';c.textBaseline='middle';c.fillText(glyph,25,23);
    };
    if(id==='ball'){
      line([[25,3],[25,11]],'#b7a6d5',2);oval(25,24,12,12,'#d7e4f2','#657699');
      for(let y=16;y<=32;y+=5) line([[16,y],[34,y]],'#91a5c8',1);
      for(let x=17;x<=33;x+=5) line([[x,16],[x,32]],'#91a5c8',1);
      oval(21,19,3,2,'#fff',null);poly([[34,6],[36,10],[40,12],[36,14],[34,18],[32,14],[28,12],[32,10]],'#ffd261',null);
    } else emoji({santa:'🎅',elf:'🧝',reindeer:'🦌',snowman:'⛄',snowflake:'❄️',popper:'🎉',fireworks:'🎆',clock:'🕛',sparkles:'✨',toast:'🥂'}[id] || '✨');
    // Draw the pointer last, so it stays visible on light and dark pages.
    poly([[1,1],[1,16],[5,12],[9,18],[12,16],[8,10],[14,10]],'#fff','#253247');
    const url=canvas.toDataURL('image/png');
    cache.set(id,url);
    return url;
  }
  function apply() {
    const id = fine.matches ? selection(new Date()) : '';
    if (id === previous) return;
    previous = id;
    if (!id) {
      root.removeAttribute('data-holiday-cursor');
      root.style.removeProperty('--holiday-cursor');
      return;
    }
    const url = artwork(id);
    if (!url) return;
    if (!style) {
      style = document.createElement('style');
      style.textContent = 'html[data-holiday-cursor]{cursor:var(--holiday-cursor),auto} html[data-holiday-cursor] :is(a[href],button:not(:disabled),summary,[role="button"],label[for],select){cursor:var(--holiday-cursor),pointer} html[data-holiday-cursor] :is(input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="password"],input[type="number"],input[type="url"],input[type="tel"],textarea,[contenteditable="true"]){cursor:text} html[data-holiday-cursor] :is(:disabled,[aria-disabled="true"]){cursor:not-allowed}';
      document.head.append(style);
    }
    root.style.setProperty('--holiday-cursor','url("' + url + '") 1 1');
    root.setAttribute('data-holiday-cursor',id);
  }
  // Avoid any effect on touch-only devices; update immediately on returning to a tab.
  apply();
  setInterval(apply, 15000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)apply();});
  if(fine.addEventListener)fine.addEventListener('change',apply);
  else if(fine.addListener)fine.addListener(apply);
})();
