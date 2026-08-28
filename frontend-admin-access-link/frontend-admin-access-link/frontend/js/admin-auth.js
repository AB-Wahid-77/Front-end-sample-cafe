/* ==========================================================================
   AMBER & ASH — admin session (uses js/api.js — load this AFTER it)
   Mirrors the structure of js/auth.js (customer session) but resolves
   against the backend's completely separate Admin model/token
   (src/models/Admin.js, src/middleware/authMiddleware.js,
   src/controllers/authController.js). Kept in its own file, with its
   own token key (amberAshAdminToken, see js/api.js) and its own
   currentAdmin variable, so a customer session and an admin session
   can never be confused with each other — this is what "do not mix
   customer authentication and admin authentication" means in
   practice: two clearly separate code paths sharing only the same
   central apiRequest()/fetch machinery.

   Only loaded on admin-login.html and admin-dashboard.html — never on
   the public site pages.
   ========================================================================== */

let currentAdmin = null; // safe admin info only (id/name/email/role) — never the token itself beyond localStorage, never the password

async function restoreAdminSession(){
  const token = getAdminToken();
  if(!token){
    currentAdmin = null;
    return null;
  }
  try{
    const res = await API.getAdminMe();
    currentAdmin = res.data.admin;
  }catch(err){
    // Invalid/expired token — drop it and fall back to logged-out state.
    clearAdminToken();
    currentAdmin = null;
  }
  return currentAdmin;
}

function logoutAdmin(){
  // Same as customer logout (js/auth.js) — the backend's JWTs are
  // stateless, so there is nothing server-side to invalidate. Logout
  // here is purely client-side: discard the token and clear state.
  clearAdminToken();
  currentAdmin = null;
  window.location.href = "admin-login.html";
}

/* Call at the top of any admin page that requires a session. Redirects
   to admin-login.html if there is no valid admin session — the
   backend's authMiddleware remains the real authority on every actual
   API call regardless; this is purely a frontend convenience so an
   unauthenticated visitor doesn't see an empty/broken dashboard shell
   before every request starts failing with 401s. */
async function requireAdminAuth(){
  await restoreAdminSession();
  if(!currentAdmin){
    window.location.href = "admin-login.html";
    return false;
  }
  return true;
}
