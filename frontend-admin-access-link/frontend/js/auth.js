/* ==========================================================================
   AMBER & ASH — customer auth/session (uses js/api.js — load this AFTER it)
   ONE implementation for: token storage, session restore, login state UI,
   and logout. No other file should touch amberAshCustomerToken directly.
   ========================================================================== */

let currentCustomer = null; // safe customer info only (id/name/email/phone) — never the token itself beyond localStorage, never the password

/* ---------- nav UI ---------- */
function accountIconSVG(){
  return `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.9 3.6-7 8-7s8 3.1 8 7"/></svg>`;
}
function logoutIconSVG(){
  return `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 17l5-5-5-5M20 12H9M13 4H6a2 2 0 00-2 2v12a2 2 0 002 2h7"/></svg>`;
}

function renderAccountNav(){
  document.querySelectorAll(".nav-actions").forEach(nav => {
    let slot = nav.querySelector("#nav-account-slot");
    if(!slot){
      slot = document.createElement("span");
      slot.id = "nav-account-slot";
      slot.style.display = "flex";
      slot.style.alignItems = "center";
      slot.style.gap = "8px";
      const hamburger = nav.querySelector(".hamburger");
      if(hamburger) nav.insertBefore(slot, hamburger);
      else nav.appendChild(slot);
    }

    if(currentCustomer){
      const firstName = (currentCustomer.name || "").split(" ")[0] || "Account";
      slot.innerHTML = `
        <a href="account.html" style="color:inherit;font-size:.85rem;opacity:.85;" class="nav-account-name">Hi, ${firstName}</a>
        <button type="button" class="icon-btn" id="nav-logout-btn" aria-label="Log out">${logoutIconSVG()}</button>`;
      const btn = slot.querySelector("#nav-logout-btn");
      if(btn) btn.addEventListener("click", handleLogoutClick);
    } else {
      slot.innerHTML = `<a href="login.html" class="icon-btn" aria-label="Log in">${accountIconSVG()}</a>`;
    }
  });
}

function handleLogoutClick(){
  logoutCustomer();
  if(typeof showToast === "function") showToast("You have been logged out");
}

/* ---------- session lifecycle ---------- */
function logoutCustomer(){
  // The backend's JWTs are stateless — there is no server-side session
  // to invalidate, so logout here is purely client-side: discard the
  // token and clear local state. See backend Part 5 logout endpoint,
  // which documents the same thing.
  clearCustomerToken();
  currentCustomer = null;
  renderAccountNav();
  // Ownership reverts to the browser's guest id — refresh so the
  // badge reflects that guest cart instead of the customer's.
  if(typeof refreshCart === "function") refreshCart();
}

async function restoreCustomerSession(){
  const token = getCustomerToken();
  if(!token){
    renderAccountNav();
    return;
  }
  try{
    const res = await API.getCustomerMe();
    currentCustomer = res.data.customer;
  }catch(err){
    // Invalid/expired token — drop it and fall back to logged-out state.
    clearCustomerToken();
    currentCustomer = null;
  }
  renderAccountNav();
}

document.addEventListener("DOMContentLoaded", restoreCustomerSession);
