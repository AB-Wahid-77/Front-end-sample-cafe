/* ==========================================================================
   AMBER & ASH — admin dashboard (Part 3)
   Uses the existing central API helper (js/api.js) and admin session
   (js/admin-auth.js) exclusively — no new fetch wrapper, no new auth.
   Every list/mutation below maps to a real backend admin route; see
   the comment above each render*Section function for exactly which.
   ========================================================================== */

const PRODUCT_CATEGORIES = ["Coffee", "Tea", "Dessert", "Snacks", "Cold Drinks", "Special Drinks"];

// ---- Product image upload (Part 3.1) ----
// Mirrors backend src/middleware/upload.js exactly — same allowed
// types and size limit, checked here first purely so the admin gets
// an instant message instead of waiting on a round trip for a file
// the server would reject anyway. The server re-validates regardless.
const PRODUCT_IMAGE_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
// Same branded placeholder as js/data.js's FALLBACK_PRODUCT_IMAGE —
// duplicated here (not imported) because admin-dashboard.html
// intentionally does not load data.js (that file's loadMenuItems()
// fires an unrelated GET /products on load, which the dashboard
// doesn't need — it already fetches products itself in
// renderProductsSection() below).
const ADMIN_FALLBACK_IMAGE = "data:image/svg+xml," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#FFF8E7"/>
  <g transform="translate(50,44)" fill="none" stroke="#6F4E37" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-19,-8 h32 v14 a16,16 0 0 1 -16,16 h0 a16,16 0 0 1 -16,-16 z"/>
    <path d="M13,-4 a8,8 0 0 1 0,15 h-3"/>
  </g>
  <text x="50" y="82" text-anchor="middle" font-family="Georgia, serif" font-size="9" fill="#8a6a52">No image</text>
</svg>`.trim());
const ORDER_STATUSES = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"];
const ORDER_TERMINAL_STATUSES = ["completed", "cancelled"];
// Mirrors backend src/controllers/reservationController.js exactly —
// anything not a key here is a terminal reservation state.
const RESERVATION_TRANSITIONS = {
  pending: ["confirmed", "rejected", "cancelled"],
  confirmed: ["completed", "cancelled", "no_show"],
};

const STATUS_LABELS = {
  pending: "Pending", confirmed: "Confirmed", preparing: "Preparing", ready: "Ready",
  completed: "Completed", cancelled: "Cancelled", rejected: "Rejected", no_show: "No-show",
};
function statusPill(status){
  return `<span class="status-pill status-${status}">${STATUS_LABELS[status] || status}</span>`;
}
function escapeHTML(str){
  return String(str == null ? "" : str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// Same toast markup/classes as the public site's js/cart.js — kept as
// a small local copy here rather than including all of cart.js (which
// would also pull in its unrelated guest-cart fetch on page load).
function showToast(message){
  let wrap = document.getElementById("toast-wrap");
  if(!wrap){
    wrap = document.createElement("div");
    wrap.id = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span class="dot"></span><span>${escapeHTML(message)}</span>`;
  wrap.appendChild(toast);
  setTimeout(()=>{
    toast.classList.add("leaving");
    setTimeout(()=>toast.remove(), 350);
  }, 2600);
}

let adminActiveSection = "overview";
let productsCache = [];

const SECTION_TITLES = {
  overview: "Overview", products: "Products", orders: "Orders",
  reservations: "Reservations", reviews: "Reviews", customers: "Customers",
};

/* ---------- shell ---------- */
async function initAdminDashboard(){
  const ok = await requireAdminAuth();
  if(!ok) return;
  document.getElementById("admin-name").textContent = currentAdmin.name || currentAdmin.email;
  document.querySelectorAll(".admin-nav-link").forEach(link=>{
    link.addEventListener("click", (e) => {
      e.preventDefault();
      switchAdminSection(link.dataset.section);
    });
  });
  document.getElementById("admin-logout-btn").addEventListener("click", logoutAdmin);
  switchAdminSection("overview");
}

function switchAdminSection(section){
  adminActiveSection = section;
  document.querySelectorAll(".admin-nav-link").forEach(link=>{
    link.classList.toggle("active", link.dataset.section === section);
  });
  document.getElementById("admin-page-title").textContent = SECTION_TITLES[section];
  const map = {
    overview: renderOverviewSection,
    products: renderProductsSection,
    orders: renderOrdersSection,
    reservations: renderReservationsSection,
    reviews: renderReviewsSection,
    customers: renderCustomersSection,
  };
  (map[section] || renderOverviewSection)();
}

function adminMain(){ return document.getElementById("admin-content"); }
function loadingHTML(label){ return `<p style="text-align:center;color:var(--text-soft);padding:40px 0;">${label}</p>`; }
function errorHTML(message){ return `<p style="text-align:center;color:var(--text-soft);padding:40px 0;">${escapeHTML(message)}</p>`; }

/* ==========================================================================
   OVERVIEW — counts pulled live from the real list endpoints below
   (GET /products, GET /admin/orders, GET /admin/reservations,
   GET /admin/reviews). No stored/cached statistics table exists in
   the backend, so these are simple counts of what those endpoints
   return right now, labelled as such rather than presented as a
   dedicated analytics feature.
   ========================================================================== */
async function renderOverviewSection(){
  const main = adminMain();
  main.innerHTML = loadingHTML("Loading dashboard…");
  try{
    const [productsRes, ordersRes, reservationsRes, reviewsRes] = await Promise.all([
      API.getProducts(),
      API.adminListOrders(),
      API.adminListReservations(),
      API.adminListReviews({ limit: 1 }),
    ]);
    const products = productsRes.data.products;
    const orders = ordersRes.data.orders;
    const reservations = reservationsRes.data.reservations;
    const pendingOrders = orders.filter(o => o.status === "pending").length;
    const pendingReservations = reservations.filter(r => r.status === "pending").length;

    main.innerHTML = `
      <div class="admin-stats-grid">
        <div class="admin-stat-card"><div class="num">${products.length}</div><div class="label">Total Products</div></div>
        <div class="admin-stat-card"><div class="num">${orders.length}</div><div class="label">Total Orders</div></div>
        <div class="admin-stat-card"><div class="num">${pendingOrders}</div><div class="label">Pending Orders</div></div>
        <div class="admin-stat-card"><div class="num">${reservations.length}</div><div class="label">Total Reservations</div></div>
        <div class="admin-stat-card"><div class="num">${pendingReservations}</div><div class="label">Pending Reservations</div></div>
        <div class="admin-stat-card"><div class="num">${reviewsRes.data.pagination.totalCount}</div><div class="label">Total Reviews</div></div>
      </div>
      <p class="admin-stat-note">These are live counts from your Products, Orders, Reservations, and Reviews data — not a separate analytics feature.</p>
    `;
  }catch(err){
    main.innerHTML = errorHTML(err.message);
  }
}

/* ==========================================================================
   PRODUCTS — GET /products (public), POST/PATCH/DELETE /products,
   PATCH /products/:id/availability (all admin-gated server-side via
   authMiddleware). Fields come straight from src/models/Product.js —
   name, description, price, category (fixed enum), image, isAvailable.
   ========================================================================== */
async function renderProductsSection(){
  const main = adminMain();
  main.innerHTML = loadingHTML("Loading products…");
  try{
    const res = await API.getProducts();
    productsCache = res.data.products;
  }catch(err){
    main.innerHTML = errorHTML(err.message);
    return;
  }

  main.innerHTML = `
    <div class="admin-card">
      <div class="admin-toolbar">
        <span style="color:var(--text-soft);font-size:.88rem;">${productsCache.length} product${productsCache.length===1?"":"s"}</span>
        <button type="button" class="btn btn-primary btn-sm" id="add-product-btn">+ Add Product</button>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Available</th><th></th></tr></thead>
          <tbody>${productsCache.map(productRowHTML).join("")}</tbody>
        </table>
      </div>
    </div>`;

  document.getElementById("add-product-btn").addEventListener("click", () => openProductModal(null));
  productsCache.forEach(p => {
    document.getElementById(`edit-product-${p._id}`)?.addEventListener("click", () => openProductModal(p));
    document.getElementById(`toggle-product-${p._id}`)?.addEventListener("click", () => toggleProductAvailability(p));
    document.getElementById(`delete-product-${p._id}`)?.addEventListener("click", () => deleteProduct(p));
  });
}

function productRowHTML(p){
  return `
    <tr>
      <td><img class="admin-product-thumb" src="${p.image || ADMIN_FALLBACK_IMAGE}" alt="" onerror="this.onerror=null;this.src=ADMIN_FALLBACK_IMAGE;"></td>
      <td><strong>${escapeHTML(p.name)}</strong></td>
      <td>${escapeHTML(p.category)}</td>
      <td>$${p.price.toFixed(2)}</td>
      <td><span class="admin-available-badge ${p.isAvailable ? "yes" : "no"}">${p.isAvailable ? "Available" : "Unavailable"}</span></td>
      <td>
        <div class="admin-row-actions">
          <button type="button" id="edit-product-${p._id}">Edit</button>
          <button type="button" id="toggle-product-${p._id}">${p.isAvailable ? "Mark Unavailable" : "Mark Available"}</button>
          <button type="button" class="danger" id="delete-product-${p._id}">Delete</button>
        </div>
      </td>
    </tr>`;
}

async function toggleProductAvailability(product){
  try{
    await API.adminSetProductAvailability(product._id, !product.isAvailable);
    showToast(`${product.name} marked ${!product.isAvailable ? "available" : "unavailable"}`);
    renderProductsSection();
  }catch(err){
    showToast(err.message);
  }
}

async function deleteProduct(product){
  if(!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
  try{
    await API.adminDeleteProduct(product._id);
    showToast("Product deleted");
    renderProductsSection();
  }catch(err){
    showToast(err.message);
  }
}

function ensureAdminModal(){
  let overlay = document.getElementById("admin-modal-overlay");
  if(overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "admin-modal-overlay";
  overlay.className = "admin-modal-overlay";
  overlay.innerHTML = `
    <div class="admin-modal" role="dialog" aria-modal="true">
      <button type="button" class="admin-modal-close" id="admin-modal-close" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      <div id="admin-modal-body"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => { if(e.target === overlay) closeAdminModal(); });
  document.getElementById("admin-modal-close").addEventListener("click", closeAdminModal);
  return overlay;
}
function closeAdminModal(){
  document.getElementById("admin-modal-overlay")?.classList.remove("open");
}

function openProductModal(product){
  const overlay = ensureAdminModal();
  const isEdit = Boolean(product);
  const categoryOptions = PRODUCT_CATEGORIES.map(c =>
    `<option value="${c}" ${isEdit && product.category === c ? "selected" : ""}>${c}</option>`).join("");

  // Closure state for the image field only — everything else stays a
  // plain form input read at submit time like before.
  // `imageMode` is which tab is active ("file" or "url").
  // `selectedFile` is a File chosen from disk (file mode).
  // `pastedUrl`/`pastedUrlVerified` track a typed URL — verified only
  // means "this exact string was confirmed to actually load an image
  // just now"; it's invalidated the moment the text changes again, so
  // a stale/broken link can never slip through unchecked at submit.
  // `keptImageUrl` is the product's existing image when editing and
  // neither of the above has replaced it.
  let imageMode = "file";
  let selectedFile = null;
  let pastedUrl = "";
  let pastedUrlVerified = false;
  const keptImageUrl = isEdit ? (product.image || "") : "";

  document.getElementById("admin-modal-body").innerHTML = `
    <h3 style="margin-bottom:20px;">${isEdit ? "Edit Product" : "Add Product"}</h3>
    <form id="product-form" novalidate>
      <div class="field"><label for="pm-name">Name <span class="req">*</span></label>
        <input type="text" id="pm-name" value="${isEdit ? escapeHTML(product.name) : ""}"><span class="error-msg"></span></div>
      <div class="field"><label for="pm-description">Description <span class="req">*</span></label>
        <textarea id="pm-description">${isEdit ? escapeHTML(product.description) : ""}</textarea><span class="error-msg"></span></div>
      <div class="field"><label for="pm-price">Price ($) <span class="req">*</span></label>
        <input type="number" step="0.01" min="0" id="pm-price" value="${isEdit ? product.price : ""}"><span class="error-msg"></span></div>
      <div class="field"><label for="pm-category">Category <span class="req">*</span></label>
        <select id="pm-category"><option value="">Select category</option>${categoryOptions}</select><span class="error-msg"></span></div>
      <div class="field">
        <label>Product Image</label>
        <div class="admin-image-upload">
          <img id="pm-image-preview" class="admin-image-preview" src="${escapeHTML(keptImageUrl) || ADMIN_FALLBACK_IMAGE}" alt="">
          <div class="admin-image-upload-controls">
            <div class="admin-image-mode-tabs">
              <button type="button" class="admin-image-mode-tab active" id="pm-mode-file-btn">Upload from device</button>
              <button type="button" class="admin-image-mode-tab" id="pm-mode-url-btn">Paste image URL</button>
            </div>

            <div id="pm-mode-file-panel">
              <input type="file" id="pm-image-input" accept="image/jpeg,image/png,image/webp" style="display:none;">
              <button type="button" class="btn btn-outline btn-sm" id="pm-image-choose-btn">Choose Image</button>
              <span class="admin-image-hint">JPG, PNG, or WebP — under 5 MB</span>
            </div>

            <div id="pm-mode-url-panel" style="display:none;">
              <div style="display:flex;gap:8px;">
                <input type="text" id="pm-image-url" placeholder="https://example.com/photo.jpg" style="flex:1;">
                <button type="button" class="btn btn-outline btn-sm" id="pm-image-url-preview-btn">Preview</button>
              </div>
              <span class="admin-image-hint">Must be a DIRECT link to the image file itself, not a webpage — on most sites, right-click the image → "Copy image address".</span>
            </div>

            ${isEdit && keptImageUrl ? `<button type="button" class="btn btn-outline btn-sm" id="pm-image-reset-btn">Keep Current Image</button>` : ""}
            <span class="error-msg" id="pm-image-error"></span>
          </div>
        </div>
      </div>
      <div class="field" style="flex-direction:row;align-items:center;gap:10px;">
        <input type="checkbox" id="pm-available" style="width:auto;" ${!isEdit || product.isAvailable ? "checked" : ""}>
        <label for="pm-available" style="margin:0;">Available for ordering</label>
      </div>
      <button type="submit" class="btn btn-primary btn-block" id="pm-submit-btn">${isEdit ? "Save Changes" : "Create Product"}</button>
    </form>`;

  overlay.classList.add("open");

  const previewEl = document.getElementById("pm-image-preview");
  const fileInputEl = document.getElementById("pm-image-input");
  const urlInputEl = document.getElementById("pm-image-url");
  const imageErrorEl = document.getElementById("pm-image-error");
  const resetBtn = document.getElementById("pm-image-reset-btn");
  const modeFileBtn = document.getElementById("pm-mode-file-btn");
  const modeUrlBtn = document.getElementById("pm-mode-url-btn");
  const modeFilePanel = document.getElementById("pm-mode-file-panel");
  const modeUrlPanel = document.getElementById("pm-mode-url-panel");

  function showFallbackPreview(){
    previewEl.onerror = null;
    previewEl.src = ADMIN_FALLBACK_IMAGE;
  }
  function resetPreviewToKept(){
    previewEl.onerror = showFallbackPreview;
    previewEl.src = keptImageUrl || ADMIN_FALLBACK_IMAGE;
  }
  resetPreviewToKept();

  document.getElementById("pm-image-choose-btn").addEventListener("click", () => fileInputEl.click());

  modeFileBtn.addEventListener("click", () => {
    imageMode = "file";
    modeFileBtn.classList.add("active");
    modeUrlBtn.classList.remove("active");
    modeFilePanel.style.display = "";
    modeUrlPanel.style.display = "none";
    imageErrorEl.textContent = "";
    if(selectedFile){ previewEl.onerror = showFallbackPreview; previewEl.src = URL.createObjectURL(selectedFile); }
    else resetPreviewToKept();
  });

  modeUrlBtn.addEventListener("click", () => {
    imageMode = "url";
    modeUrlBtn.classList.add("active");
    modeFileBtn.classList.remove("active");
    modeUrlPanel.style.display = "";
    modeFilePanel.style.display = "none";
    imageErrorEl.textContent = "";
    if(pastedUrlVerified && urlInputEl.value.trim() === pastedUrl){ previewEl.onerror = showFallbackPreview; previewEl.src = pastedUrl; }
    else resetPreviewToKept();
  });

  fileInputEl.addEventListener("change", () => {
    const file = fileInputEl.files[0];
    imageErrorEl.textContent = "";
    if(!file) return;

    if(!PRODUCT_IMAGE_ALLOWED_TYPES.includes(file.type) || file.size > PRODUCT_IMAGE_MAX_BYTES){
      imageErrorEl.textContent = "Please select a JPG, PNG, or WebP image under 5 MB.";
      fileInputEl.value = "";
      return;
    }

    selectedFile = file;
    // Local-only preview via a blob URL — never sent anywhere or
    // saved as the product's image; replaced by the real Cloudinary
    // URL once upload succeeds on submit.
    previewEl.onerror = showFallbackPreview;
    previewEl.src = URL.createObjectURL(file);
  });

  // URL mode is verified explicitly (Preview button), not on every
  // keystroke — a stale/never-clicked value never counts as
  // verified, and editing the text after a successful preview
  // immediately un-verifies it (see the 'input' listener below), so
  // the submit handler can trust `pastedUrlVerified` completely.
  document.getElementById("pm-image-url-preview-btn").addEventListener("click", () => {
    const val = urlInputEl.value.trim();
    imageErrorEl.textContent = "";
    pastedUrlVerified = false;

    if(!val){
      imageErrorEl.textContent = "Enter an image link first.";
      return;
    }
    if(!/^https?:\/\//i.test(val)){
      imageErrorEl.textContent = "Please enter a full link starting with http:// or https://";
      return;
    }

    previewEl.onload = () => {
      pastedUrl = val;
      pastedUrlVerified = true;
      imageErrorEl.textContent = "";
      previewEl.onload = null;
    };
    previewEl.onerror = () => {
      imageErrorEl.textContent = "Couldn't load an image from that link — it may not be a direct image link, or the site blocks outside embedding. Try right-clicking the image itself and choosing \"Copy image address\".";
      previewEl.onerror = null;
      previewEl.onload = null;
      showFallbackPreview();
    };
    previewEl.src = val;
  });

  urlInputEl.addEventListener("input", () => {
    // Any edit after a successful preview un-verifies it, so submit
    // can never use a URL that wasn't checked against its current text.
    pastedUrlVerified = false;
  });

  resetBtn?.addEventListener("click", () => {
    selectedFile = null;
    fileInputEl.value = "";
    pastedUrl = "";
    pastedUrlVerified = false;
    urlInputEl.value = "";
    imageErrorEl.textContent = "";
    resetPreviewToKept();
  });

  document.getElementById("product-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nameEl = document.getElementById("pm-name");
    const descEl = document.getElementById("pm-description");
    const priceEl = document.getElementById("pm-price");
    const categoryEl = document.getElementById("pm-category");
    const availableEl = document.getElementById("pm-available");

    const checks = [
      validateField(nameEl, { required:true }),
      validateField(descEl, { required:true }),
      validateField(priceEl, { required:true }),
      validateField(categoryEl, { required:true }),
    ];
    if(!checks.every(Boolean)){
      showToast("Please fix the highlighted fields");
      return;
    }

    // Guard against a chosen-but-unverified URL: if the admin is on
    // the URL tab, typed something, but never clicked Preview (or
    // edited the text after previewing), do NOT silently fall back
    // to the old image — make them confirm it first. This is exactly
    // the gap that caused broken images before.
    if(imageMode === "url" && urlInputEl.value.trim() && !pastedUrlVerified){
      showToast("Please click Preview and confirm the image loads before saving");
      return;
    }

    const submitBtn = document.getElementById("pm-submit-btn");
    submitBtn.disabled = true;

    try{
      // Resolve the image field first, based on the active tab:
      // upload a newly chosen file to get a permanent Cloudinary URL,
      // use a verified pasted URL directly, or otherwise keep
      // whatever URL the product already had (empty string for a
      // brand-new product with no image chosen).
      let imageUrl = keptImageUrl;
      if(imageMode === "file" && selectedFile){
        submitBtn.textContent = "Uploading image…";
        const uploadRes = await API.adminUploadProductImage(selectedFile);
        imageUrl = uploadRes.data.url;
      }else if(imageMode === "url" && pastedUrlVerified){
        imageUrl = pastedUrl;
      }

      const payload = {
        name: nameEl.value.trim(),
        description: descEl.value.trim(),
        price: Number(priceEl.value),
        category: categoryEl.value,
        image: imageUrl,
        isAvailable: availableEl.checked,
      };

      submitBtn.textContent = "Saving product…";
      if(isEdit){
        await API.adminUpdateProduct(product._id, payload);
        showToast("Product updated");
      }else{
        await API.adminCreateProduct(payload);
        showToast("Product created");
      }
      closeAdminModal();
      renderProductsSection();
    }catch(err){
      // Distinguish "image uploaded but product save failed" from a
      // plain upload failure, so the admin isn't left thinking
      // nothing happened when the image did in fact upload.
      showToast(err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? "Save Changes" : "Create Product";
    }
  });
}

/* ==========================================================================
   ORDERS — GET /admin/orders(?status=), GET /admin/orders/:id,
   PATCH /admin/orders/:id/status. Status values and the "terminal
   state" rule come straight from src/models/Order.js /
   src/controllers/orderController.js — not invented here.
   ========================================================================== */
let ordersFilter = "";
async function renderOrdersSection(){
  const main = adminMain();
  main.innerHTML = loadingHTML("Loading orders…");
  let orders;
  try{
    const res = await API.adminListOrders(ordersFilter ? { status: ordersFilter } : {});
    orders = res.data.orders;
  }catch(err){
    main.innerHTML = errorHTML(err.message);
    return;
  }

  main.innerHTML = `
    <div class="admin-card">
      <div class="admin-toolbar">
        <span style="color:var(--text-soft);font-size:.88rem;">${orders.length} order${orders.length===1?"":"s"}</span>
        <select id="orders-status-filter">
          <option value="">All statuses</option>
          ${ORDER_STATUSES.map(s => `<option value="${s}" ${ordersFilter===s?"selected":""}>${STATUS_LABELS[s]}</option>`).join("")}
        </select>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Order #</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>${orders.map(orderRowHTML).join("") || `<tr><td colspan="6" style="text-align:center;color:var(--text-soft);">No orders found.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;

  document.getElementById("orders-status-filter").addEventListener("change", (e) => {
    ordersFilter = e.target.value;
    renderOrdersSection();
  });
  orders.forEach(o => {
    document.getElementById(`order-status-${o._id}`)?.addEventListener("change", (e) => updateOrderStatus(o, e.target.value));
  });
}

function orderRowHTML(o){
  const isTerminal = ORDER_TERMINAL_STATUSES.includes(o.status);
  const itemsSummary = o.items.map(i => `${i.name} ×${i.quantity}`).join(", ");
  const statusControl = isTerminal
    ? statusPill(o.status)
    : `<select id="order-status-${o._id}">${ORDER_STATUSES.map(s => `<option value="${s}" ${s===o.status?"selected":""}>${STATUS_LABELS[s]}</option>`).join("")}</select>`;
  return `
    <tr>
      <td><strong>${o.orderNumber}</strong></td>
      <td>${escapeHTML(o.customerDetails.name)}<br><span style="color:var(--text-soft);font-size:.8rem;">${escapeHTML(o.customerDetails.email)}</span></td>
      <td>${new Date(o.createdAt).toLocaleString()}</td>
      <td title="${escapeHTML(itemsSummary)}">${o.items.length} item${o.items.length===1?"":"s"}</td>
      <td>$${o.total.toFixed(2)}</td>
      <td>${statusControl}</td>
    </tr>`;
}

async function updateOrderStatus(order, newStatus){
  if(newStatus === order.status) return;
  try{
    await API.adminUpdateOrderStatus(order._id, newStatus);
    showToast(`Order ${order.orderNumber} set to ${STATUS_LABELS[newStatus]}`);
    renderOrdersSection();
  }catch(err){
    showToast(err.message);
    renderOrdersSection();
  }
}

/* ==========================================================================
   RESERVATIONS — GET /admin/reservations(?status=&date=),
   PATCH /admin/reservations/:id/status. The status dropdown only
   offers the transitions the backend actually allows
   (RESERVATION_TRANSITIONS above, copied from
   src/controllers/reservationController.js) so the admin never gets a
   guaranteed-400 from picking an invalid next status.
   ========================================================================== */
let reservationsStatusFilter = "";
async function renderReservationsSection(){
  const main = adminMain();
  main.innerHTML = loadingHTML("Loading reservations…");
  let reservations;
  try{
    const res = await API.adminListReservations(reservationsStatusFilter ? { status: reservationsStatusFilter } : {});
    reservations = res.data.reservations;
  }catch(err){
    main.innerHTML = errorHTML(err.message);
    return;
  }

  main.innerHTML = `
    <div class="admin-card">
      <div class="admin-toolbar">
        <span style="color:var(--text-soft);font-size:.88rem;">${reservations.length} reservation${reservations.length===1?"":"s"}</span>
        <select id="reservations-status-filter">
          <option value="">All statuses</option>
          ${Object.keys(STATUS_LABELS).map(s => `<option value="${s}" ${reservationsStatusFilter===s?"selected":""}>${STATUS_LABELS[s]}</option>`).join("")}
        </select>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Reservation #</th><th>Customer</th><th>Date &amp; Time</th><th>Party</th><th>Status</th></tr></thead>
          <tbody>${reservations.map(reservationRowHTML).join("") || `<tr><td colspan="5" style="text-align:center;color:var(--text-soft);">No reservations found.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;

  document.getElementById("reservations-status-filter").addEventListener("change", (e) => {
    reservationsStatusFilter = e.target.value;
    renderReservationsSection();
  });
  reservations.forEach(r => {
    document.getElementById(`reservation-status-${r._id}`)?.addEventListener("change", (e) => updateReservationStatus(r, e.target.value));
  });
}

function reservationRowHTML(r){
  const nextOptions = RESERVATION_TRANSITIONS[r.status];
  const statusControl = nextOptions
    ? `<select id="reservation-status-${r._id}">
        <option value="${r.status}" selected>${STATUS_LABELS[r.status]} (current)</option>
        ${nextOptions.map(s => `<option value="${s}">${STATUS_LABELS[s]}</option>`).join("")}
      </select>`
    : statusPill(r.status);
  return `
    <tr>
      <td><strong>${r.reservationNumber}</strong></td>
      <td>${escapeHTML(r.customerDetails.name)}<br><span style="color:var(--text-soft);font-size:.8rem;">${escapeHTML(r.customerDetails.phone)}</span></td>
      <td>${r.date} at ${r.time}</td>
      <td>${r.partySize}</td>
      <td>${statusControl}</td>
    </tr>`;
}

async function updateReservationStatus(reservation, newStatus){
  if(newStatus === reservation.status) return;
  try{
    await API.adminUpdateReservationStatus(reservation._id, newStatus);
    showToast(`Reservation ${reservation.reservationNumber} set to ${STATUS_LABELS[newStatus]}`);
    renderReservationsSection();
  }catch(err){
    showToast(err.message);
    renderReservationsSection();
  }
}

/* ==========================================================================
   REVIEWS — GET /admin/reviews(?product=&rating=&isApproved=),
   DELETE /admin/reviews/:id. Moderation here means delete — the
   backend has no "approve/reject" mutation endpoint, only the
   isApproved field to filter by, so no approve/reject button is shown
   (would be a fake action with nothing behind it).
   ========================================================================== */
let reviewsRatingFilter = "";
async function renderReviewsSection(){
  const main = adminMain();
  main.innerHTML = loadingHTML("Loading reviews…");
  let reviews;
  try{
    const res = await API.adminListReviews({ rating: reviewsRatingFilter, limit: 50 });
    reviews = res.data.reviews;
  }catch(err){
    main.innerHTML = errorHTML(err.message);
    return;
  }

  main.innerHTML = `
    <div class="admin-card">
      <div class="admin-toolbar">
        <span style="color:var(--text-soft);font-size:.88rem;">${reviews.length} review${reviews.length===1?"":"s"} (most recent 50)</span>
        <select id="reviews-rating-filter">
          <option value="">All ratings</option>
          ${[5,4,3,2,1].map(n => `<option value="${n}" ${reviewsRatingFilter==String(n)?"selected":""}>${n} star${n===1?"":"s"}</option>`).join("")}
        </select>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Product</th><th>Customer</th><th>Rating</th><th>Comment</th><th>Date</th><th></th></tr></thead>
          <tbody>${reviews.map(reviewRowHTML).join("") || `<tr><td colspan="6" style="text-align:center;color:var(--text-soft);">No reviews found.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;

  document.getElementById("reviews-rating-filter").addEventListener("change", (e) => {
    reviewsRatingFilter = e.target.value;
    renderReviewsSection();
  });
  reviews.forEach(r => {
    document.getElementById(`delete-review-${r._id}`)?.addEventListener("click", () => deleteReviewAdmin(r));
  });
}

function reviewRowHTML(r){
  return `
    <tr>
      <td>${escapeHTML(r.product?.name || "—")}</td>
      <td>${escapeHTML(r.customer?.name || "—")}<br><span style="color:var(--text-soft);font-size:.8rem;">${escapeHTML(r.customer?.email || "")}</span></td>
      <td>${"★".repeat(r.rating)}${"☆".repeat(5-r.rating)}</td>
      <td style="max-width:260px;">${escapeHTML(r.comment || "")}</td>
      <td>${new Date(r.createdAt).toLocaleDateString()}</td>
      <td><button type="button" class="danger" id="delete-review-${r._id}">Delete</button></td>
    </tr>`;
}

async function deleteReviewAdmin(review){
  if(!confirm("Delete this review? This cannot be undone.")) return;
  try{
    await API.adminDeleteReview(review._id);
    showToast("Review deleted");
    renderReviewsSection();
  }catch(err){
    showToast(err.message);
  }
}

/* ==========================================================================
   CUSTOMERS — the backend has NO admin customer-list/detail endpoint
   anywhere (checked every route file). Rather than invent one or loop
   over orders/reservations to fake a customer list, this section is
   left as an honest, clearly-labelled gap.
   ========================================================================== */
function renderCustomersSection(){
  adminMain().innerHTML = `
    <div class="admin-unavailable-note">
      Customer management isn't available yet — the backend doesn't currently provide an
      admin endpoint to list or view customer accounts (only customers themselves can see
      their own profile, via <code>GET /api/v1/auth/customer/me</code>). This section will
      need a new backend route before it can be built.
    </div>`;
}
