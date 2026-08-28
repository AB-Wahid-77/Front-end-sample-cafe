/* ==========================================================================
   AMBER & ASH — main UI behaviors
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  initLoadingScreen();
  initTheme();
  initNavbar();
  initMobileMenu();
  initActiveNav();
  initRipple();
  initScrollReveal();
  initCounters();
  initBackToTop();
  initTypingEffect();
  initTestimonialSlider();
  initGalleryLightbox();
  initThemeToggleButtons();
  initSmoothAnchors();
});

/* ---------- loading screen ---------- */
function initLoadingScreen(){
  const screen = document.getElementById("loading-screen");
  if(!screen) return;
  window.addEventListener("load", () => {
    setTimeout(()=> screen.classList.add("hidden"), 350);
  });
  // fallback in case load already fired
  setTimeout(()=> screen.classList.add("hidden"), 2200);
}

/* ---------- navbar solid-on-scroll + progress bar ---------- */
function initNavbar(){
  const nav = document.querySelector(".navbar");
  const progress = document.getElementById("scroll-progress");
  if(!nav && !progress) return;
  const onScroll = () => {
    const y = window.scrollY;
    if(nav) nav.classList.toggle("solid", y > 60);
    if(progress){
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const pct = height > 0 ? (y / height) * 100 : 0;
      progress.style.width = pct + "%";
    }
  };
  document.addEventListener("scroll", onScroll, { passive:true });
  onScroll();
}

/* ---------- mobile menu ---------- */
function initMobileMenu(){
  const btn = document.querySelector(".hamburger");
  const menu = document.querySelector(".mobile-menu");
  const overlay = document.querySelector(".menu-overlay");
  if(!btn || !menu) return;
  const close = () => { btn.classList.remove("open"); menu.classList.remove("open"); overlay?.classList.remove("open"); document.body.style.overflow = ""; };
  const open = () => { btn.classList.add("open"); menu.classList.add("open"); overlay?.classList.add("open"); document.body.style.overflow = "hidden"; };
  btn.addEventListener("click", () => btn.classList.contains("open") ? close() : open());
  overlay?.addEventListener("click", close);
  menu.querySelectorAll("a").forEach(a => a.addEventListener("click", close));
}

/* ---------- active nav link highlighting ---------- */
function initActiveNav(){
  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a, .mobile-menu a").forEach(a=>{
    const href = a.getAttribute("href");
    if(href === path || (path === "" && href === "index.html")){
      a.classList.add("active");
    }
  });
}

/* ---------- button ripple effect ---------- */
function initRipple(){
  document.querySelectorAll(".btn, .add-cart-btn, .filter-tab").forEach(btn=>{
    btn.addEventListener("click", function(e){
      const rect = this.getBoundingClientRect();
      const circle = document.createElement("span");
      const size = Math.max(rect.width, rect.height);
      circle.className = "ripple";
      circle.style.width = circle.style.height = size + "px";
      circle.style.left = (e.clientX - rect.left - size/2) + "px";
      circle.style.top = (e.clientY - rect.top - size/2) + "px";
      this.style.position = this.style.position || "relative";
      this.appendChild(circle);
      setTimeout(()=>circle.remove(), 650);
    });
  });
}

/* ---------- scroll reveal via IntersectionObserver ---------- */
function initScrollReveal(){
  const targets = document.querySelectorAll("[data-reveal]");
  if(!targets.length) return;
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold:0.15, rootMargin:"0px 0px -60px 0px" });
  targets.forEach((t,i)=>{
    t.style.setProperty("--i", i % 8);
    observer.observe(t);
  });
}

/* ---------- animated counters ---------- */
function initCounters(){
  const counters = document.querySelectorAll("[data-counter]");
  if(!counters.length) return;
  const animate = (el) => {
    const target = parseFloat(el.dataset.counter);
    const suffix = el.dataset.suffix || "";
    const duration = 1600;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target) + suffix;
      if(progress < 1) requestAnimationFrame(tick);
      else el.textContent = target + suffix;
    };
    requestAnimationFrame(tick);
  };
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        animate(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold:0.6 });
  counters.forEach(c => observer.observe(c));
}

/* ---------- back to top ---------- */
function initBackToTop(){
  const btn = document.getElementById("back-to-top");
  if(!btn) return;
  document.addEventListener("scroll", () => {
    btn.classList.toggle("show", window.scrollY > 480);
  }, { passive:true });
  btn.addEventListener("click", () => window.scrollTo({ top:0, behavior:"smooth" }));
}

/* ---------- hero typing effect ---------- */
function initTypingEffect(){
  const el = document.querySelector("[data-typing]");
  if(!el) return;
  const phrases = JSON.parse(el.dataset.typing);
  let phraseIndex = 0, charIndex = 0, deleting = false;
  const speed = 55, pause = 1600;
  function tick(){
    const phrase = phrases[phraseIndex];
    if(!deleting){
      charIndex++;
      el.textContent = phrase.slice(0, charIndex);
      if(charIndex === phrase.length){
        deleting = true;
        setTimeout(tick, pause);
        return;
      }
    } else {
      charIndex--;
      el.textContent = phrase.slice(0, charIndex);
      if(charIndex === 0){
        deleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
      }
    }
    setTimeout(tick, deleting ? speed/2 : speed);
  }
  tick();
}

/* ---------- testimonial slider ---------- */
function initTestimonialSlider(){
  const track = document.querySelector(".testi-slides");
  if(!track) return;
  const slides = track.children.length;
  const dotsWrap = document.querySelector(".testi-dots");
  let index = 0, timer;

  if(dotsWrap){
    dotsWrap.innerHTML = "";
    for(let i=0;i<slides;i++){
      const dot = document.createElement("button");
      dot.className = "testi-dot" + (i===0 ? " active" : "");
      dot.setAttribute("aria-label", "Go to testimonial " + (i+1));
      dot.addEventListener("click", ()=> goTo(i));
      dotsWrap.appendChild(dot);
    }
  }
  function update(){
    track.style.transform = `translateX(-${index*100}%)`;
    dotsWrap?.querySelectorAll(".testi-dot").forEach((d,i)=>d.classList.toggle("active", i===index));
  }
  function goTo(i){ index = (i+slides)%slides; update(); restart(); }
  function next(){ goTo(index+1); }
  function prev(){ goTo(index-1); }
  function restart(){ clearInterval(timer); timer = setInterval(next, 5000); }

  document.querySelector(".testi-next")?.addEventListener("click", next);
  document.querySelector(".testi-prev")?.addEventListener("click", prev);
  update();
  restart();
}

/* ---------- gallery lightbox ---------- */
function initGalleryLightbox(){
  const items = document.querySelectorAll(".gallery-item");
  const lightbox = document.getElementById("lightbox");
  if(!items.length || !lightbox) return;
  const imgEl = lightbox.querySelector("img");
  const captionEl = lightbox.querySelector(".lightbox-caption");
  const images = Array.from(items).map(i => ({ src:i.querySelector("img").src, caption:i.dataset.caption || "" }));
  let current = 0;

  function open(i){
    current = i;
    imgEl.src = images[i].src;
    imgEl.alt = images[i].caption;
    captionEl.textContent = images[i].caption;
    lightbox.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function close(){ lightbox.classList.remove("open"); document.body.style.overflow = ""; }
  function next(){ open((current+1)%images.length); }
  function prev(){ open((current-1+images.length)%images.length); }

  items.forEach((item,i)=> item.addEventListener("click", ()=>open(i)));
  lightbox.querySelector(".lightbox-close")?.addEventListener("click", close);
  lightbox.querySelector(".lightbox-next")?.addEventListener("click", next);
  lightbox.querySelector(".lightbox-prev")?.addEventListener("click", prev);
  lightbox.addEventListener("click", (e)=>{ if(e.target === lightbox) close(); });
  document.addEventListener("keydown", (e)=>{
    if(!lightbox.classList.contains("open")) return;
    if(e.key === "Escape") close();
    if(e.key === "ArrowRight") next();
    if(e.key === "ArrowLeft") prev();
  });
}

/* ---------- theme toggle buttons ---------- */
function initThemeToggleButtons(){
  document.querySelectorAll(".theme-toggle").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const next = getTheme() === "dark" ? "light" : "dark";
      applyTheme(next);
    });
  });
}

/* ---------- smooth anchor scroll for in-page links ---------- */
function initSmoothAnchors(){
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener("click", (e)=>{
      const id = a.getAttribute("href");
      if(id.length < 2) return;
      const target = document.querySelector(id);
      if(target){
        e.preventDefault();
        const y = target.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top:y, behavior:"smooth" });
      }
    });
  });
}

/* ==========================================================================
   Form validation helpers (used by reservation.html & checkout.html)
   ========================================================================== */
function validateField(input, rules){
  const field = input.closest(".field");
  const errorEl = field?.querySelector(".error-msg");
  let message = "";

  if(rules.required && !input.value.trim()){
    message = "This field is required.";
  } else if(rules.email && input.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())){
    message = "Enter a valid email address.";
  } else if(rules.phone && input.value.trim() && !/^[+]?[\d\s()-]{7,}$/.test(input.value.trim())){
    message = "Enter a valid phone number.";
  } else if(rules.min !== undefined && Number(input.value) < rules.min){
    message = `Minimum value is ${rules.min}.`;
  }

  if(field){
    field.classList.toggle("error", !!message);
    if(errorEl) errorEl.textContent = message;
  }
  return !message;
}

/* ---------- visual transition layer: UI only, no data or API changes ---------- */
(function initPageTransitions(){
  const ready = () => {
    document.body.classList.add('page-ready');
    const sameOriginLinks = document.querySelectorAll('a[href]');
    sameOriginLinks.forEach(link => {
      const href = link.getAttribute('href');
      if(!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || link.target === '_blank') return;
      link.addEventListener('click', (event) => {
        const url = new URL(href, window.location.href);
        if(url.origin !== window.location.origin) return;
        event.preventDefault();
        document.body.classList.add('page-leaving');
        window.setTimeout(() => { window.location.href = url.href; }, 180);
      });
    });
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
