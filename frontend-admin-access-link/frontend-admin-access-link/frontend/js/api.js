/* ==========================================================================
   AMBER & ASH — central API helper
   ONE place for the backend base URL, the fetch wrapper, and every
   endpoint call the frontend makes. No other file should build a raw
   fetch() to the backend — see js/auth.js for how this is consumed.
   ========================================================================== */
const APT_BASE_URI = "https://backend-nine-ochre-17.vercel.app/api/v1";
const CUSTOMER_TOKEN_KEY = "amberAshCustomerToken";
// PART 2: the backend's Cart/Order/Reservation APIs (Backend Parts 4/6)
// scope ownership to either an authenticated customer OR a client-
// generated guest id sent as the X-Guest-Id header — this is the
// backend's existing guest-cart mechanism, not a new one invented here.
const GUEST_ID_KEY = "amberAshGuestId";
// PART 3: the backend has a completely separate Admin model/JWT
// (src/models/Admin.js, src/middleware/authMiddleware.js) from the
// Customer one above — a different token, stored under its own key,
// so an admin and a customer session can never be confused with each
// other in the same browser. Same signing/verification MACHINERY
// (jsonwebtoken via the backend), just a different subject.
const ADMIN_TOKEN_KEY = "amberAshAdminToken";

/* ---------- token storage (customer only — never store passwords) ---------- */
function getCustomerToken(){
  try{ return localStorage.getItem(CUSTOMER_TOKEN_KEY); }
  catch(e){ return null; }
}
function setCustomerToken(token){
  try{ localStorage.setItem(CUSTOMER_TOKEN_KEY, token); }
  catch(e){ console.warn("Storage unavailable:", e); }
}
function clearCustomerToken(){
  try{ localStorage.removeItem(CUSTOMER_TOKEN_KEY); }
  catch(e){ /* ignore */ }
}

/* ---------- token storage (admin — kept under its own key, never mixed with the customer token above) ---------- */
function getAdminToken(){
  try{ return localStorage.getItem(ADMIN_TOKEN_KEY); }
  catch(e){ return null; }
}
function setAdminToken(token){
  try{ localStorage.setItem(ADMIN_TOKEN_KEY, token); }
  catch(e){ console.warn("Storage unavailable:", e); }
}
function clearAdminToken(){
  try{ localStorage.removeItem(ADMIN_TOKEN_KEY); }
  catch(e){ /* ignore */ }
}

/* ---------- guest id (for cart/order/reservation ownership pre-login) ---------- */
function getGuestId(){
  try{
    let id = localStorage.getItem(GUEST_ID_KEY);
    if(!id){
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(GUEST_ID_KEY, id);
    }
    return id;
  }catch(e){
    return `guest-${Date.now()}`;
  }
}

/* ---------- query string helper (admin list filters) ---------- */
function buildQuery(params){
  const usable = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if(!usable.length) return "";
  return "?" + usable.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
}

/* ---------- central request helper ----------
   opts: { method, body, auth, guestScoped, adminAuth } — auth:true
   attaches the stored CUSTOMER JWT; adminAuth:true attaches the
   stored ADMIN JWT instead. The two are never combined on the same
   request — every backend route in this project requires exactly one
   or the other (or neither).
   Throws an ApiError with a safe, user-facing `.message` on any
   HTTP or network failure — callers show that message via showToast()
   rather than a raw error. */
class ApiError extends Error {
  constructor(message, status){
    super(message);
    this.name = "ApiError";
    this.status = status || 0;
  }
}

async function apiRequest(path, opts = {}){
  const { method = "GET", body, auth = false, guestScoped = false, adminAuth = false } = opts;
  const headers = { "Content-Type": "application/json" };

  if(auth){
    const token = getCustomerToken();
    if(token) headers["Authorization"] = `Bearer ${token}`;
  }

  if(adminAuth){
    const token = getAdminToken();
    if(token) headers["Authorization"] = `Bearer ${token}`;
  }

  if(guestScoped){
    // Send BOTH when available — the backend prefers the authenticated
    // customer identity when a valid Bearer token is present, and
    // falls back to X-Guest-Id otherwise (see backend
    // src/utils/getGuestId.js). Sending the guest id even while logged
    // in is harmless and keeps behavior consistent if the token turns
    // out to be expired.
    const token = getCustomerToken();
    if(token) headers["Authorization"] = `Bearer ${token}`;
    headers["X-Guest-Id"] = getGuestId();
  }

  let response;
  try{
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }catch(networkErr){
    // fetch() itself threw — the server is unreachable, offline, CORS
    // blocked, etc. Never surface the raw TypeError to the customer.
    throw new ApiError("Unable to connect to the server. Please try again.", 0);
  }

  let data = null;
  try{ data = await response.json(); }
  catch(parseErr){ /* empty/non-JSON body — data stays null */ }

  if(!response.ok){
    const message = (data && data.message) ? data.message : "Something went wrong. Please try again.";
    throw new ApiError(message, response.status);
  }

  return data;
}

/* ---------- specific endpoint calls used by this integration part ---------- */
const API = {
  health: () => apiRequest("/health"),

  registerCustomer: (payload) => apiRequest("/auth/customer/register", { method: "POST", body: payload }),
  loginCustomer: (payload) => apiRequest("/auth/customer/login", { method: "POST", body: payload }),
  getCustomerMe: () => apiRequest("/auth/customer/me", { auth: true }),

  getProducts: () => apiRequest("/products"),

  // ---- Cart (Backend Part 4) ----
  getCart: () => apiRequest("/cart", { guestScoped: true }),
  addCartItem: (productId, quantity) =>
    apiRequest("/cart/items", { method: "POST", guestScoped: true, body: { productId, quantity } }),
  updateCartItemQty: (productId, quantity) =>
    apiRequest(`/cart/items/${productId}`, { method: "PATCH", guestScoped: true, body: { quantity } }),
  removeCartItem: (productId) =>
    apiRequest(`/cart/items/${productId}`, { method: "DELETE", guestScoped: true }),
  clearCart: () => apiRequest("/cart", { method: "DELETE", guestScoped: true }),

  // ---- Orders (Backend Part 4) ----
  createOrder: (payload) => apiRequest("/orders", { method: "POST", guestScoped: true, body: payload }),
  getOrder: (orderId) => apiRequest(`/orders/${orderId}`, { guestScoped: true }),
  cancelOrder: (orderId) => apiRequest(`/orders/${orderId}/cancel`, { method: "PATCH", guestScoped: true }),

  // ---- Customer order history (Backend Part 5) ----
  getCustomerOrders: () => apiRequest("/auth/customer/orders", { auth: true }),

  // ---- Reservations (Backend Part 6) ----
  createReservation: (payload) => apiRequest("/reservations", { method: "POST", guestScoped: true, body: payload }),
  getMyReservations: () => apiRequest("/reservations", { guestScoped: true }),
  getReservation: (id) => apiRequest(`/reservations/${id}`, { guestScoped: true }),
  cancelReservation: (id) => apiRequest(`/reservations/${id}/cancel`, { method: "PATCH", guestScoped: true }),

  // ---- Reviews (Backend Part 7 — customer-authenticated only) ----
  getProductReviews: (productId, page = 1, limit = 10) =>
    apiRequest(`/products/${productId}/reviews?page=${page}&limit=${limit}`),
  createReview: (productId, payload) =>
    apiRequest(`/products/${productId}/reviews`, { method: "POST", auth: true, body: payload }),
  updateReview: (reviewId, payload) =>
    apiRequest(`/reviews/${reviewId}`, { method: "PATCH", auth: true, body: payload }),
  deleteReview: (reviewId) => apiRequest(`/reviews/${reviewId}`, { method: "DELETE", auth: true }),

  // ==================== PART 3 ====================

  // ---- Customer profile/password (Backend Part 5 — customerAuthController) ----
  updateCustomerProfile: (payload) => apiRequest("/auth/customer/me", { method: "PATCH", auth: true, body: payload }),
  changeCustomerPassword: (payload) => apiRequest("/auth/customer/password", { method: "PATCH", auth: true, body: payload }),
  logoutCustomerServer: () => apiRequest("/auth/customer/logout", { method: "POST", auth: true }),

  // ---- Admin auth (Backend Part 1 — authController, completely
  // separate from customer auth above; own token, own storage key) ----
  loginAdmin: (payload) => apiRequest("/auth/login", { method: "POST", body: payload }),
  getAdminMe: () => apiRequest("/auth/me", { adminAuth: true }),

  // ---- Admin products (Backend Part 3 — same /products resource
  // customers browse; POST/PATCH/DELETE are admin-gated server-side) ----
  adminCreateProduct: (payload) => apiRequest("/products", { method: "POST", adminAuth: true, body: payload }),
  adminUpdateProduct: (id, payload) => apiRequest(`/products/${id}`, { method: "PATCH", adminAuth: true, body: payload }),
  adminDeleteProduct: (id) => apiRequest(`/products/${id}`, { method: "DELETE", adminAuth: true }),
  adminSetProductAvailability: (id, isAvailable) =>
    apiRequest(`/products/${id}/availability`, { method: "PATCH", adminAuth: true, body: { isAvailable } }),

  // ---- Admin product image upload (POST /uploads/product-image) ----
  // Not routed through apiRequest() above because that helper always
  // JSON-encodes the body; this one sends multipart/form-data instead
  // (the browser sets the correct boundary header automatically when
  // the body is a FormData — never set Content-Type manually here).
  // Returns { url, publicId }; the caller passes `url` to the
  // existing adminCreateProduct/adminUpdateProduct calls unchanged.
  adminUploadProductImage: async (file) => {
    const headers = {};
    const token = getAdminToken();
    if(token) headers["Authorization"] = `Bearer ${token}`;

    const formData = new FormData();
    formData.append("image", file);

    let response;
    try{
      response = await fetch(`${API_BASE_URL}/uploads/product-image`, {
        method: "POST",
        headers,
        body: formData,
      });
    }catch(networkErr){
      throw new ApiError("Unable to connect to the server. Please try again.", 0);
    }

    let data = null;
    try{ data = await response.json(); }
    catch(parseErr){ /* empty/non-JSON body — data stays null */ }

    if(!response.ok){
      const message = (data && data.message) ? data.message : "Image upload failed. Please try again.";
      throw new ApiError(message, response.status);
    }

    return data;
  },

  // ---- Admin orders (Backend Part 4) ----
  adminListOrders: (filters = {}) => apiRequest(`/admin/orders${buildQuery(filters)}`, { adminAuth: true }),
  adminGetOrder: (id) => apiRequest(`/admin/orders/${id}`, { adminAuth: true }),
  adminUpdateOrderStatus: (id, status) =>
    apiRequest(`/admin/orders/${id}/status`, { method: "PATCH", adminAuth: true, body: { status } }),

  // ---- Admin reservations (Backend Part 6) ----
  adminListReservations: (filters = {}) => apiRequest(`/admin/reservations${buildQuery(filters)}`, { adminAuth: true }),
  adminGetReservation: (id) => apiRequest(`/admin/reservations/${id}`, { adminAuth: true }),
  adminUpdateReservationStatus: (id, status) =>
    apiRequest(`/admin/reservations/${id}/status`, { method: "PATCH", adminAuth: true, body: { status } }),

  // ---- Admin reviews (Backend Part 7) ----
  adminListReviews: (filters = {}) => apiRequest(`/admin/reviews${buildQuery(filters)}`, { adminAuth: true }),
  adminGetReview: (id) => apiRequest(`/admin/reviews/${id}`, { adminAuth: true }),
  adminDeleteReview: (id) => apiRequest(`/admin/reviews/${id}`, { method: "DELETE", adminAuth: true }),
};
