/* ==========================================================================
   AMBER & ASH — product reviews (Backend Part 7)
   PART 2 INTEGRATION: the frontend had no review/rating UI at all
   before this — this file adds a single reusable modal (triggered from
   the "Reviews" button added to each ticket card in js/cart.js) rather
   than a new full page, to avoid redesigning the product grid. Reuses
   the existing js/api.js helper, validateField-style patterns, and
   showToast() — no new API helper, no new auth system.

   There is no dedicated "get my review for product X" backend
   endpoint, so when a customer who already reviewed a product tries
   to submit again (409 conflict), this file does a one-off scan of
   that product's reviews (up to 50) to find their own review id and
   switch the form into edit mode. This only happens on that conflict
   path, not on every modal open.
   ========================================================================== */

let reviewModalState = { productId: null, productName: null, page: 1, totalPages: 1, myReviewId: null };

function starRow(rating){
  let out = "";
  for(let i=1;i<=5;i++){
    out += `<span style="opacity:${i<=rating?1:.25}">${starSVG()}</span>`;
  }
  return `<span class="review-item-stars">${out}</span>`;
}

function ensureReviewModal(){
  let overlay = document.getElementById("review-modal-overlay");
  if(overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "review-modal-overlay";
  overlay.className = "review-modal-overlay";
  overlay.innerHTML = `
    <div class="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-modal-title">
      <button type="button" class="review-modal-close" id="review-modal-close" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      <h3 id="review-modal-title" style="margin-bottom:4px;"></h3>
      <div id="review-summary" class="review-summary-row"></div>
      <div id="review-form-wrap"></div>
      <div id="review-list"></div>
      <button type="button" class="btn btn-outline btn-sm" id="review-load-more" style="display:none;margin-top:14px;">Load more reviews</button>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => { if(e.target === overlay) closeReviewsModal(); });
  document.getElementById("review-modal-close").addEventListener("click", closeReviewsModal);
  document.getElementById("review-load-more").addEventListener("click", loadMoreReviews);

  return overlay;
}

async function openReviewsModal(productId, productName){
  const overlay = ensureReviewModal();
  reviewModalState = { productId, productName, page: 1, totalPages: 1, myReviewId: null };
  document.getElementById("review-modal-title").textContent = `Reviews — ${productName}`;
  document.getElementById("review-summary").textContent = "Loading…";
  document.getElementById("review-list").innerHTML = "";
  document.getElementById("review-load-more").style.display = "none";
  renderReviewForm(null); // create-mode by default until we know otherwise
  overlay.classList.add("open");

  await loadReviewsPage(1, false);
}

function closeReviewsModal(){
  const overlay = document.getElementById("review-modal-overlay");
  if(overlay) overlay.classList.remove("open");
}

async function loadReviewsPage(page, append){
  try{
    const res = await API.getProductReviews(reviewModalState.productId, page);
    const { reviews, summary, pagination } = res.data;
    reviewModalState.page = pagination.page;
    reviewModalState.totalPages = pagination.totalPages;

    document.getElementById("review-summary").innerHTML =
      summary.reviewCount > 0
        ? `${starSVG()} ${summary.averageRating.toFixed(1)} <span style="color:var(--text-soft);font-weight:400;">(${summary.reviewCount} review${summary.reviewCount===1?"":"s"})</span>`
        : `<span style="color:var(--text-soft);font-weight:400;">No reviews yet — be the first!</span>`;

    const listEl = document.getElementById("review-list");
    const rowsHtml = reviews.map(r => `
      <div class="review-item">
        <div class="review-item-head">
          <span>${(r.customer && r.customer.name) ? r.customer.name : "A customer"}</span>
          <span class="review-item-date">${new Date(r.createdAt).toLocaleDateString()}</span>
        </div>
        ${starRow(r.rating)}
        ${r.comment ? `<p class="review-item-comment">${r.comment}</p>` : ""}
      </div>`).join("");

    if(append) listEl.insertAdjacentHTML("beforeend", rowsHtml);
    else listEl.innerHTML = rowsHtml || `<p style="color:var(--text-soft);">No reviews yet.</p>`;

    document.getElementById("review-load-more").style.display =
      reviewModalState.page < reviewModalState.totalPages ? "block" : "none";
  }catch(err){
    document.getElementById("review-summary").textContent = "";
    document.getElementById("review-list").innerHTML =
      `<p style="color:var(--text-soft);">${err.message || "Unable to load reviews. Please try again."}</p>`;
  }
}

function loadMoreReviews(){
  loadReviewsPage(reviewModalState.page + 1, true);
}

function renderReviewForm(existingReview){
  const wrap = document.getElementById("review-form-wrap");

  if(!currentCustomer){
    wrap.innerHTML = `<p style="color:var(--text-soft);margin-bottom:18px;">
      <a href="login.html" style="color:var(--gold);">Log in</a> to write a review.</p>`;
    return;
  }

  const isEdit = Boolean(existingReview);
  const selectedRating = isEdit ? existingReview.rating : 0;

  wrap.innerHTML = `
    <form id="review-form" novalidate style="margin-bottom:22px;">
      <div class="review-form-rating" id="review-rating-buttons"></div>
      <div class="field full"><textarea id="review-comment" placeholder="Optional comment (max 1000 characters)" maxlength="1000">${isEdit ? (existingReview.comment || "") : ""}</textarea></div>
      <div style="display:flex;gap:10px;">
        <button type="submit" class="btn btn-primary btn-sm">${isEdit ? "Update Review" : "Submit Review"}</button>
        ${isEdit ? `<button type="button" class="btn btn-outline btn-sm" id="review-delete-btn">Delete Review</button>` : ""}
      </div>
    </form>`;

  let currentRating = selectedRating;
  const ratingWrap = document.getElementById("review-rating-buttons");
  ratingWrap.innerHTML = [1,2,3,4,5].map(n =>
    `<button type="button" data-n="${n}" class="${n<=currentRating?"selected":""}" aria-label="${n} star${n>1?"s":""}">${starSVG()}</button>`
  ).join("");
  ratingWrap.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-n]");
    if(!btn) return;
    currentRating = Number(btn.dataset.n);
    ratingWrap.querySelectorAll("button").forEach(b => b.classList.toggle("selected", Number(b.dataset.n) <= currentRating));
  });

  document.getElementById("review-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if(currentRating < 1){
      showToast("Please select a star rating");
      return;
    }
    const comment = document.getElementById("review-comment").value.trim();
    const submitBtn = e.target.querySelector("button[type=submit]");
    submitBtn.disabled = true;

    try{
      if(isEdit){
        await API.updateReview(existingReview._id, { rating: currentRating, comment });
        showToast("Review updated");
      } else {
        const res = await API.createReview(reviewModalState.productId, { rating: currentRating, comment });
        showToast("Review submitted — thank you!");
        reviewModalState.myReviewId = res.data.review._id;
      }
      await loadReviewsPage(1, false);
      if(isEdit){
        renderReviewForm({ _id: existingReview._id, rating: currentRating, comment });
      }
    }catch(err){
      if(err.status === 409 && !isEdit){
        // Already reviewed — locate it and switch to edit mode.
        showToast("You've already reviewed this item — showing it below to edit.");
        await switchToEditMyReview();
      } else {
        showToast(err.message || "Could not save your review");
      }
    }finally{
      submitBtn.disabled = false;
    }
  });

  if(isEdit){
    document.getElementById("review-delete-btn").addEventListener("click", async () => {
      try{
        await API.deleteReview(existingReview._id);
        showToast("Review deleted");
        renderReviewForm(null);
        await loadReviewsPage(1, false);
      }catch(err){
        showToast(err.message || "Could not delete review");
      }
    });
  }
}

async function switchToEditMyReview(){
  try{
    const res = await API.getProductReviews(reviewModalState.productId, 1, 50);
    const mine = res.data.reviews.find(r => r.customer && String(r.customer._id) === String(currentCustomer.id));
    if(mine){
      renderReviewForm(mine);
    }
  }catch(err){
    // If this lookup fails, the create-mode form simply stays as-is —
    // the customer can retry from a fresh modal open.
  }
}
