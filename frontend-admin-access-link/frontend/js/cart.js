/* ==========================================================================
   AMBER & ASH — cart engine
   PART 2 INTEGRATION: cart data now lives on the backend (Backend
   Part 4 Cart API) instead of localStorage. Ownership is resolved by
   the central API helper (js/api.js) via the customer JWT when logged
   in, or a generated X-Guest-Id otherwise — the same guest mechanism
   the backend already defines. There is only ONE cart system now; the
   old aa_cart localStorage key is no longer used.

   Everything NOT related to cart data (favorites, theme, toasts,
   ticket rendering) is unchanged from Integration Part 1.

   Keys still in use: aa_theme, aa_favorites, aa_recent
   ========================================================================== */

const LS_THEME = "aa_theme";
const LS_FAVS = "aa_favorites";
const LS_RECENT = "aa_recent";

/* ---------- storage helpers ---------- */
function readJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(e){ return fallback; }
}
function writeJSON(key, value){
  try{ localStorage.setItem(key, JSON.stringify(value)); }
  catch(e){ console.warn("Storage unavailable:", e); }
}

/* ---------- cart (backend-backed) ----------
   cartCache mirrors the backend Cart document — {guestId, items, subtotal}.
   items: [{ product, name, price, quantity }] (price is the backend's
   authoritative snapshot price, never a frontend value).
   Call refreshCart() once per page that needs live cart data; the
   individual mutation functions below already refresh the cache
   themselves after a successful call. */
let cartCache = { items: [], subtotal: 0 };

async function refreshCart(){
  try{
    const res = await API.getCart();
    cartCache = res.data.cart;
  }catch(err){
    // Network/server issue — keep the last known cache rather than
    // wiping the UI, and let the caller's own error handling (if any)
    // decide whether to notify the user.
    console.warn("Could not load cart:", err.message);
  }
  updateCartBadge();
  return cartCache;
}

function cartCount(){
  return cartCache.items.reduce((sum, item) => sum + item.quantity, 0);
}

async function addToCart(productId, qty = 1){
  try{
    const res = await API.addCartItem(productId, qty);
    cartCache = res.data.cart;
    updateCartBadge();
    const item = cartCache.items.find(i => i.product === productId);
    showToast(`${item ? item.name : "Item"} added to cart`);
    return true;
  }catch(err){
    showToast(err.message || "Could not add item to cart");
    return false;
  }
}

async function setQty(productId, qty){
  try{
    let res;
    if(qty <= 0){
      res = await API.removeCartItem(productId);
    } else {
      res = await API.updateCartItemQty(productId, qty);
    }
    cartCache = res.data.cart;
    updateCartBadge();
    return true;
  }catch(err){
    showToast(err.message || "Could not update cart");
    return false;
  }
}

async function removeFromCart(productId){
  try{
    const res = await API.removeCartItem(productId);
    cartCache = res.data.cart;
    updateCartBadge();
    showToast("Item removed from cart");
    return true;
  }catch(err){
    showToast(err.message || "Could not remove item");
    return false;
  }
}

async function clearCartRemote(){
  try{
    const res = await API.clearCart();
    cartCache = res.data.cart;
    updateCartBadge();
    showToast("Cart cleared");
    return true;
  }catch(err){
    showToast(err.message || "Could not clear cart");
    return false;
  }
}

function updateCartBadge(){
  document.querySelectorAll(".cart-badge").forEach(b=>{
    const n = cartCount();
    b.textContent = n;
    b.style.display = n > 0 ? "flex" : "none";
  });
}

/* ---------- favorites (unchanged — local UI preference, not order data) ---------- */
function getFavorites(){ return readJSON(LS_FAVS, []); }
function isFavorite(id){ return getFavorites().includes(id); }
function toggleFavorite(id){
  let favs = getFavorites();
  if(favs.includes(id)){
    favs = favs.filter(f=>f!==id);
    showToast("Removed from favorites");
  } else {
    favs.push(id);
    showToast("Added to favorites");
  }
  writeJSON(LS_FAVS, favs);
  document.querySelectorAll(`.fav-btn[data-id="${id}"]`).forEach(btn=>{
    btn.classList.toggle("active", favs.includes(id));
  });
}

/* ---------- recently viewed ---------- */
function addRecent(id){
  let recent = readJSON(LS_RECENT, []);
  recent = recent.filter(r=>r!==id);
  recent.unshift(id);
  recent = recent.slice(0,6);
  writeJSON(LS_RECENT, recent);
}
function getRecent(){ return readJSON(LS_RECENT, []); }

/* ---------- theme ---------- */
function getTheme(){ return localStorage.getItem(LS_THEME) || "light"; }
function applyTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(LS_THEME, theme);
}
function initTheme(){
  applyTheme(getTheme());
}

/* ---------- toasts ---------- */
function showToast(message){
  let wrap = document.getElementById("toast-wrap");
  if(!wrap){
    wrap = document.createElement("div");
    wrap.id = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span class="dot"></span><span>${message}</span>`;
  wrap.appendChild(toast);
  setTimeout(()=>{
    toast.classList.add("leaving");
    setTimeout(()=>toast.remove(), 350);
  }, 2600);
}

/* ---------- rating stars (svg string) ---------- */
function starSVG(){
  return `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6L1.3 7.7l6.1-.6z"/></svg>`;
}
function heartSVG(){
  return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.8-10-9.5C.5 8 2 4.5 5.5 4A5.7 5.7 0 0112 7a5.7 5.7 0 016.5-3c3.5.5 5 4 3.5 7.5C19.5 16.2 12 21 12 21z"/></svg>`;
}
function beanMeter(roast){
  let dots = "";
  for(let i=1;i<=5;i++){ dots += `<span class="bean-dot ${i<=roast?"filled":""}"></span>`; }
  return `<span class="beans">${dots}</span>`;
}

/* ---------- render a ticket card for a menu item ---------- */
function renderTicket(item){
  const fav = isFavorite(item.id) ? "active" : "";
  const roastRow = item.roast
    ? `<div class="roast-meter">${beanMeter(item.roast)} Roast</div>`
    : `<div class="roast-meter">Baked fresh daily</div>`;
  const safeName = item.name.replace(/'/g, "&#39;");
  return `
  <article class="ticket" data-reveal="scale" data-category="${item.category}" data-name="${item.name.toLowerCase()}">
    <div class="ticket-img">
      <img src="${item.img}" alt="${item.name}" loading="lazy" onerror="this.onerror=null;this.src=FALLBACK_PRODUCT_IMAGE;">
      ${item.badge ? `<span class="ticket-badge">${item.badge}</span>` : ""}
      <button class="fav-btn ${fav}" data-id="${item.id}" aria-label="Toggle favorite for ${item.name}" onclick="toggleFavorite('${item.id}')">${heartSVG()}</button>
    </div>
    <div class="ticket-perf"></div>
    <div class="ticket-body">
      <div class="ticket-top">
        <h3 class="ticket-name">${item.name}</h3>
        <span class="ticket-price">$${item.price.toFixed(2)}</span>
      </div>
      <p class="ticket-desc">${item.desc}</p>
      <div class="ticket-top" style="align-items:center;">
        ${roastRow}
        <span class="ticket-rating">${starSVG()} ${item.rating}</span>
      </div>
      <div class="ticket-foot">
        <div class="qty-stepper" data-id="${item.id}">
          <button type="button" aria-label="Decrease quantity" onclick="stepperChange('${item.id}',-1)">−</button>
          <span id="qty-${item.id}">1</span>
          <button type="button" aria-label="Increase quantity" onclick="stepperChange('${item.id}',1)">+</button>
        </div>
        <button type="button" class="add-cart-btn" onclick="handleAddClick(this,'${item.id}')" ${item.badge === "Sold Out" ? "disabled" : ""}>Add to Cart</button>
      </div>
      <button type="button" class="btn btn-outline btn-sm" style="margin-top:12px;width:100%;" onclick="openReviewsModal('${item.id}','${safeName}')">${starSVG()} Reviews</button>
    </div>
  </article>`;
}

const stepperState = {};
function stepperChange(id, delta){
  const current = stepperState[id] || 1;
  const next = Math.min(20, Math.max(1, current + delta));
  stepperState[id] = next;
  const el = document.getElementById(`qty-${id}`);
  if(el) el.textContent = next;
}
async function handleAddClick(btn, id){
  const qty = stepperState[id] || 1;
  btn.disabled = true;
  const original = btn.textContent;
  const ok = await addToCart(id, qty);
  if(ok){
    btn.classList.add("added");
    btn.textContent = "Added ✓";
    setTimeout(()=>{ btn.classList.remove("added"); btn.textContent = original; btn.disabled = false; }, 1200);
  } else {
    btn.textContent = original;
    btn.disabled = false;
  }
  stepperState[id] = 1;
  const qtyEl = document.getElementById(`qty-${id}`);
  if(qtyEl) qtyEl.textContent = 1;
}

document.addEventListener("DOMContentLoaded", refreshCart);
