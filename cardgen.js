/* Shared helpers for Liam's PECS site: image paths, card rendering, on-device storage. */

const VARIANTS = {
  borderLabel:   "full",         // border + label
  borderNoLabel: "no label",     // border, no label
  noBorderLabel: "no border",    // no frame, label kept
  noBorderNoLabel:"photo only",  // just the picture
  clean:         "clean"
};

function variantName(border, label){
  if (border && label)  return "full";
  if (border && !label) return "no label";
  if (!border && label) return "no border";
  return "photo only";
}

function imgPath(card, variant){
  // bundled card image path
  return "PECS_Library/" + card.category + "/" + card.name + " - " + variant + ".png";
}

function loadImage(src){
  return new Promise((res, rej)=>{
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = ()=>res(im);
    im.onerror = ()=>rej(new Error("could not load "+src));
    im.src = src;
  });
}

/* Render a square PECS card onto a canvas, in the same clean style as the library.
   photo: an HTMLImageElement (the picture only).
   label: text (may be empty).
   opts: {border:true, showLabel:true, size:600}
   Returns the canvas. Background is transparent outside the rounded card. */
function renderCard(photo, label, opts){
  opts = opts || {};
  const border   = opts.border !== false;
  const showLabel= opts.showLabel !== false && label && label.trim().length>0;
  const S = opts.size || 640;
  const cv = document.createElement("canvas");
  cv.width = S; cv.height = S;
  const g = cv.getContext("2d");
  g.clearRect(0,0,S,S);

  const rad = Math.round(S*0.075);
  const stroke = Math.round(S*0.035);
  const inset = border ? Math.round(stroke/2)+1 : 1;
  // white rounded card face
  roundRect(g, inset, inset, S-2*inset, S-2*inset, rad);
  g.fillStyle = "#ffffff"; g.fill();
  if (border){ g.lineWidth = stroke; g.strokeStyle="#000000"; g.stroke(); }

  // layout: photo on top, optional label band at bottom
  const pad = Math.round(S*0.075);
  const labelH = showLabel ? Math.round(S*0.20) : 0;
  const areaX = pad, areaY = pad;
  const areaW = S - 2*pad;
  const areaH = S - 2*pad - labelH;

  if (photo){
    const pw = photo.naturalWidth || photo.width, ph = photo.naturalHeight || photo.height;
    const s = Math.min(areaW/pw, areaH/ph);
    const dw = Math.round(pw*s), dh = Math.round(ph*s);
    const dx = areaX + Math.round((areaW-dw)/2);
    const dy = areaY + Math.round((areaH-dh)/2);
    g.drawImage(photo, dx, dy, dw, dh);
  }

  if (showLabel){
    g.fillStyle = "#000000";
    g.textAlign = "center";
    g.textBaseline = "middle";
    let fs = Math.round(S*0.13);
    const maxW = S - 2*pad;
    do {
      g.font = "700 " + fs + "px 'Segoe UI', Arial, sans-serif";
      if (g.measureText(label).width <= maxW) break;
      fs -= 2;
    } while (fs > 12);
    g.fillText(label, S/2, S - pad - labelH/2 + Math.round(S*0.02));
  }
  return cv;
}

function roundRect(g,x,y,w,h,r){
  r = Math.min(r, w/2, h/2);
  g.beginPath();
  g.moveTo(x+r,y);
  g.arcTo(x+w,y,x+w,y+h,r);
  g.arcTo(x+w,y+h,x,y+h,r);
  g.arcTo(x,y+h,x,y,r);
  g.arcTo(x,y,x+w,y,r);
  g.closePath();
}

/* ---------- On-device storage (IndexedDB): user-made cards live on the tablet ---------- */
const DB_NAME="liam_pecs_db", STORE="cards";
function openDB(){
  return new Promise((res,rej)=>{
    const rq = indexedDB.open(DB_NAME,1);
    rq.onupgradeneeded = e=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE,{keyPath:"id",autoIncrement:true});
    };
    rq.onsuccess=e=>res(e.target.result);
    rq.onerror=e=>rej(e.target.error);
  });
}
async function addUserCard(rec){
  const db=await openDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction(STORE,"readwrite");
    tx.objectStore(STORE).add(rec);
    tx.oncomplete=()=>res(true);
    tx.onerror=e=>rej(e.target.error);
  });
}
async function getUserCards(){
  const db=await openDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction(STORE,"readonly");
    const rq=tx.objectStore(STORE).getAll();
    rq.onsuccess=()=>res(rq.result||[]);
    rq.onerror=e=>rej(e.target.error);
  });
}
async function deleteUserCard(id){
  const db=await openDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction(STORE,"readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete=()=>res(true);
    tx.onerror=e=>rej(e.target.error);
  });
}

/* Merge bundled + user cards into one list. Each item:
   {name,label,category,kind:'bundled'|'user', photo?:dataURL, id?} */
async function getAllCards(){
  const bundled=(window.PECS_CARDS||[]).map(c=>({name:c.name,label:c.label,category:c.category,kind:"bundled"}));
  let user=[];
  try{ user=(await getUserCards()).map(u=>({name:u.label,label:u.label,category:u.category,kind:"user",photo:u.photo,id:u.id})); }
  catch(e){ console.warn("storage unavailable",e); }
  return bundled.concat(user);
}

/* Get a photo image element for a card (bundled -> photo only png; user -> stored dataURL). */
async function cardPhoto(card){
  if (card.kind==="user") return loadImage(card.photo);
  return loadImage(imgPath(card, "photo only"));
}

/* Categories present across bundled + user cards. */
function allCategories(cards){
  const set=new Set(window.PECS_CATEGORIES||[]);
  cards.forEach(c=>set.add(c.category));
  return Array.from(set).sort();
}
