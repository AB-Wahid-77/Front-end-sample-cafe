/* ==========================================================================
   AMBER & ASH — shared menu data
   PART 1 INTEGRATION: MENU_ITEMS is now populated from the backend
   (GET /api/v1/products) instead of hardcoded here. The array
   reference, CATEGORY_LABELS, and findMenuItem() are all preserved
   exactly as other files (cart.js, menu.html, beverages.html,
   index.html) already depend on them — only the DATA SOURCE changed.

   Because loading is now async, any script that reads MENU_ITEMS on
   page load should wait for `menuItemsReady` (a Promise) or listen for
   the "menu:loaded" event on window, instead of assuming the array is
   already populated at parse time. See menu.html/beverages.html/
   index.html for the small waiting-pattern this required.

   category values stay: coffee | tea | cold | special | dessert | snacks
   (unchanged) — mapped from the backend's Title Case category names.
   ========================================================================== */

const MENU_ITEMS = [];

const CATEGORY_LABELS = {
  coffee:"Coffee", tea:"Tea", cold:"Cold Drinks", special:"Special Drinks",
  dessert:"Dessert", snacks:"Snacks"
};

// Backend Product.category (Part 3) -> existing frontend category slug.
const BACKEND_CATEGORY_TO_SLUG = {
  "Coffee": "coffee",
  "Tea": "tea",
  "Cold Drinks": "cold",
  "Special Drinks": "special",
  "Dessert": "dessert",
  "Snacks": "snacks",
};

// Branded fallback shown whenever a product has no image, or its
// image URL fails to load — replaces the old random picsum.photos
// placeholder (which is why unrelated products all showed the same
// generic mountain/lake photo before Part 3.1's image upload existed).
// A self-contained inline SVG, so it never depends on a third-party
// image service being reachable.
const FALLBACK_PRODUCT_IMAGE = "data:image/svg+xml," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450">
  <rect width="600" height="450" fill="#FFF8E7"/>
  <g transform="translate(300,185)" fill="none" stroke="#6F4E37" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-85,-35 h145 v65 a72.5,72.5 0 0 1 -72.5,72.5 h0 a72.5,72.5 0 0 1 -72.5,-72.5 z"/>
    <path d="M60,-20 a34,34 0 0 1 0,68 h-14"/>
    <path d="M-62,-65 q9,-19 0,-33" stroke="#D4AF37" stroke-width="7"/>
    <path d="M-29,-65 q9,-19 0,-33" stroke="#D4AF37" stroke-width="7"/>
    <path d="M4,-65 q9,-19 0,-33" stroke="#D4AF37" stroke-width="7"/>
  </g>
  <text x="300" y="338" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="26" fill="#3E2723">Amber &amp; Ash</text>
  <text x="300" y="366" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="15" fill="#8a6a52">Image coming soon</text>
</svg>`.trim());

function mapProductToMenuItem(product){
  return {
    id: product._id,
    name: product.name,
    // Backend has no "roast" concept — left undefined on purpose so
    // the existing ticket template's fallback text ("Baked fresh
    // daily") is used for every item instead of a fabricated value.
    category: BACKEND_CATEGORY_TO_SLUG[product.category] || "snacks",
    price: product.price,
    // Backend has no per-product rating yet (that's Part 7 Reviews,
    // out of scope for this integration part) — left as an empty
    // string rather than inventing a number.
    rating: "",
    img: product.image || FALLBACK_PRODUCT_IMAGE,
    desc: product.description,
    // Reuse the EXISTING ticket-badge UI to reflect unavailability,
    // rather than inventing a new "sold out" visual treatment.
    badge: product.isAvailable === false ? "Sold Out" : "",
  };
}

function findMenuItem(id){
  return MENU_ITEMS.find(i => i.id === id);
}

let resolveMenuItemsReady;
const menuItemsReady = new Promise((resolve) => { resolveMenuItemsReady = resolve; });

async function loadMenuItems(){
  try{
    const res = await API.getProducts();
    const products = (res && res.data && res.data.products) || [];
    MENU_ITEMS.length = 0;
    products.map(mapProductToMenuItem).forEach(item => MENU_ITEMS.push(item));
  }catch(err){
    // Leave MENU_ITEMS empty — pages that render it show their own
    // existing "no items" state, and menu.html/beverages.html show a
    // dedicated load-error message (see their inline scripts).
    console.warn("Could not load menu from the server:", err.message);
  }
  window.dispatchEvent(new CustomEvent("menu:loaded", { detail: { items: MENU_ITEMS, failed: MENU_ITEMS.length === 0 } }));
  resolveMenuItemsReady();
}

loadMenuItems();
