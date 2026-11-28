/* Seasonal cursors: deterministic Eastern-time slots, no network requests or storage. */
(() => {
  'use strict';
  const zone = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', hourCycle: 'h23'
  });
  const christmas = ['santa','rudolph','snowman','hermey','reindeer','bumble','elf','yukon','sam','clarice','misfit'];
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
    const rect = (x,y,w,h,fill) => {c.fillStyle=fill;c.fillRect(x,y,w,h);};
    const emoji = glyph => {
      c.font='27px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      c.textAlign='center';c.textBaseline='middle';c.fillText(glyph,25,23);
    };
    const face = (skin='#f5c69d') => {
      oval(25,23,10,11,skin);
      oval(21,21,1.25,1.8,'#243344',null);oval(29,21,1.25,1.8,'#243344',null);
      line([[22,28],[25,29],[28,28]],'#894937',1);
    };
    if (id === 'rudolph' || id === 'reindeer' || id === 'clarice') {
      const fur=id==='clarice'?'#d9a16b':'#ad6b38';
      line([[19,16],[15,8],[12,6]],'#714528',2.5);
      line([[16,10],[19,6],[19,3]],'#714528',2);
      line([[31,16],[35,8],[38,6]],'#714528',2.5);
      line([[34,10],[31,6],[31,3]],'#714528',2);
      oval(15,19,5,3,fur);oval(35,19,5,3,fur);
      oval(25,23,10,12,fur);
      oval(25,29,8,6,'#f2d6ae');
      oval(21,22,1.5,2.1,'#20232d',null);oval(29,22,1.5,2.1,'#20232d',null);
      if(id==='rudolph'){oval(25,28,5,4,'#ffb0a5',null);oval(25,28,4,3,'#ed222c');oval(24,27,1,1,'#fff',null);}
      else oval(25,28,3.5,2.5,'#51362b');
      if(id==='clarice'){poly([[25,12],[19,8],[19,16]],'#e84e5d');poly([[25,12],[31,8],[31,16]],'#e84e5d');oval(25,12,2,2,'#b51f3b');}
    } else if(id==='hermey' || id==='elf') {
      const hermey=id==='hermey';
      oval(14,23,4,3,'#f5c69d');oval(36,23,4,3,'#f5c69d');
      face();
      if(hermey){poly([[15,20],[14,13],[19,10],[23,13],[29,10],[35,13],[35,19],[29,17],[23,19],[18,16]],'#f8d36c');}
      poly([[15,16],[19,7],[31,4],[36,9],[35,16]],hermey?'#63aee5':'#3c9c54');
      rect(15,14,20,4,hermey?'#d7efff':'#e34d42');
      oval(36,8,2.6,2.6,hermey?'#fff':'#f5ce52');
      poly([[15,39],[17,32],[25,36],[33,32],[37,39]],hermey?'#4b9bd4':'#338b4b');
      if(hermey) rect(23,34,4,4,'#fff');
    } else if(id==='bumble'){
      poly([[10,38],[10,25],[13,24],[10,20],[15,19],[12,14],[18,14],[17,8],[22,11],[26,5],[30,11],[35,9],[34,16],[39,17],[36,23],[39,26],[38,38]],'#f7fcff','#90b7ce');
      oval(25,24,10,11,'#8ec7e8');
      oval(21,20,2,2,'#21394c',null);oval(29,20,2,2,'#21394c',null);
      oval(25,28,6,4,'#28465d');poly([[20,26],[23,26],[22,30]],'#fff',null);poly([[27,26],[30,26],[28,30]],'#fff',null);
    } else if(id==='yukon'){
      face();oval(25,30,11,8,'#d66c35');oval(21,21,1.3,1.7,'#263044',null);oval(29,21,1.3,1.7,'#263044',null);
      rect(14,11,22,6,'#4c78aa');oval(25,11,9,7,'#4c78aa');oval(25,5,4,3,'#f0c34c');rect(14,15,22,3,'#d84b35');
      oval(25,24,3,2.5,'#f1ac83');line([[18,28],[25,25],[32,28]],'#934020',2);
    } else if(id==='sam' || id==='snowman'){
      oval(25,31,11,8,'#f8fdff','#81a5be');oval(25,19,8,8,'#f8fdff','#81a5be');
      oval(22,18,1.2,1.5,'#263443',null);oval(28,18,1.2,1.5,'#263443',null);
      if(id==='sam'){rect(19,5,12,8,'#517d58');rect(15,12,20,3,'#304d3b');oval(25,31,6,7,'#598a60');line([[21,24],[29,24]],'#bb393d',3);oval(25,21,2,2,'#e9a481',null);}
      else {rect(19,4,12,9,'#293644');rect(15,12,20,3,'#293644');poly([[25,20],[33,22],[25,24]],'#ef963f');line([[17,26],[32,26]],'#d84b52',3);}
      oval(25,30,1.3,1.3,'#263443',null);oval(25,35,1.3,1.3,'#263443',null);
    } else if(id==='misfit'){
      // A little polka-dot elephant from the Island of Misfit Toys.
      oval(24,24,11,10,'#f7f3e8');oval(16,21,6,8,'#f8d8da');oval(31,23,7,8,'#f7f3e8');
      line([[35,26],[37,29],[36,34],[32,35]],'#f7f3e8',5);
      line([[35,26],[37,29],[36,34],[32,35]],'#b6a8a0',1);
      for(const [x,y] of [[16,19],[20,27],[25,17],[28,29],[23,23]]) oval(x,y,2,2,'#e66c79',null);
      oval(33,21,1.5,1.5,'#283443',null);
    } else if(id==='ball'){
      line([[25,3],[25,11]],'#b7a6d5',2);oval(25,24,12,12,'#d7e4f2','#657699');
      for(let y=16;y<=32;y+=5) line([[16,y],[34,y]],'#91a5c8',1);
      for(let x=17;x<=33;x+=5) line([[x,16],[x,32]],'#91a5c8',1);
      oval(21,19,3,2,'#fff',null);poly([[34,6],[36,10],[40,12],[36,14],[34,18],[32,14],[28,12],[32,10]],'#ffd261',null);
    } else if(id==='santa'){
      face();oval(25,29,10,9,'#fff','#c6d2dd');oval(25,22,3,2.4,'#f6b592');line([[20,25],[25,24],[30,25]],'#d1dce4',2);
      poly([[15,16],[17,8],[26,4],[36,9],[32,15]],'#dc303b');line([[15,16],[33,16]],'#fff',5);oval(36,9,3,3,'#fff','#c6d2dd');
    } else emoji({popper:'🎉',fireworks:'🎆',clock:'🕛',sparkles:'✨',toast:'🥂'}[id] || '✨');
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
