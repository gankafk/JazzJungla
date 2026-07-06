// ============================================================
// CONFIG
// ============================================================
const CONFIG = {
  API_URL: 'https://6gzvqc6w44.execute-api.us-east-1.amazonaws.com/contacto'
}

// ============================================================
// ESTADO GLOBAL
// ============================================================
let currentLang = localStorage.getItem('jjl-lang') || 'en'

// Limitar fecha de nacimiento a hoy (no fechas futuras) + contador del textarea
document.addEventListener('DOMContentLoaded', () => {
  const dobInput = document.getElementById('f-dob')
  if (dobInput) dobInput.max = new Date().toISOString().split('T')[0]

  const bg = document.getElementById('f-bg')
  const counter = document.getElementById('f-bg-counter')
  if (bg && counter) {
    const max = parseInt(bg.getAttribute('maxlength') || '4000', 10)
    const update = () => {
      const len = bg.value.length
      counter.textContent = len + ' / ' + max
      counter.classList.toggle('is-near', len > max * 0.9)
    }
    bg.addEventListener('input', update)
    update()
  }
})

// ============================================================
// NAVBAR — efecto scroll
// ============================================================
const navbar = document.getElementById('navbar')
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 80)
  navbar.classList.toggle('transparent', window.scrollY <= 80)
}, { passive: true })

// ============================================================
// HAMBURGER — menú móvil
// ============================================================
const ham         = document.getElementById('hamburger')
const mobileMenu  = document.getElementById('mobile-menu')
const overlay     = document.getElementById('overlay')

ham.addEventListener('click', () => {
  const open = ham.classList.toggle('open')
  mobileMenu.classList.toggle('open', open)
  overlay.classList.toggle('active', open)
  ham.setAttribute('aria-expanded', open)
})

overlay.addEventListener('click', closeMobile)

function closeMobile() {
  ham.classList.remove('open')
  mobileMenu.classList.remove('open')
  overlay.classList.remove('active')
  ham.setAttribute('aria-expanded', 'false')
}

function toggleMobileSub(btn) {
  const sub  = btn.nextElementSibling
  const open = !sub.hidden
  sub.hidden = open
  btn.setAttribute('aria-expanded', !open)
}

// ============================================================
// LANGUAGE TOGGLE
// ============================================================
function applyLang(lang) {
  currentLang = lang
  localStorage.setItem('jjl-lang', lang)
  document.documentElement.lang = lang

  document.querySelectorAll('[data-es], [data-en]').forEach(el => {
    const text = el.getAttribute('data-' + lang)
    if (text != null) el.textContent = text
  })

  // Placeholders bilingües de inputs/textarea (atributo placeholder, no textContent)
  document.querySelectorAll('[data-ph-es], [data-ph-en]').forEach(el => {
    const ph = el.getAttribute('data-ph-' + lang)
    if (ph != null) el.setAttribute('placeholder', ph)
  })

  const flagES = '<img src="https://flagcdn.com/w20/es.png" alt="ES" width="20" height="14" style="vertical-align:middle;border-radius:2px;margin-right:3px">'
  const flagGB = '<img src="https://flagcdn.com/w20/gb.png" alt="EN" width="20" height="14" style="vertical-align:middle;border-radius:2px;margin-right:3px">'
  const label = lang === 'es' ? `${flagES}ES` : `${flagGB}EN`
  ;['lang-toggle-desktop', 'lang-toggle-mobile-nav', 'lang-toggle-footer'].forEach(id => {
    const btn = document.getElementById(id)
    if (btn) btn.innerHTML = label
  })
}

function toggleLang() {
  applyLang(currentLang === 'es' ? 'en' : 'es')
}

document.getElementById('lang-toggle-desktop').addEventListener('click', toggleLang)
document.getElementById('lang-toggle-mobile-nav').addEventListener('click', toggleLang)
document.getElementById('lang-toggle-footer').addEventListener('click', toggleLang)

// Aplicar idioma al cargar
applyLang(currentLang)

// ============================================================
// BOOKING — tabs de edición
// ============================================================
function selectEdition(n) {
  document.getElementById('tab-1').classList.toggle('active', n === 1)
  document.getElementById('tab-2').classList.toggle('active', n === 2)
  const radio = document.querySelector(`input[name="edition"][value="${n}"]`)
  if (radio) radio.checked = true
}

// Sincronizar en sentido contrario: radio → tabs
document.querySelectorAll('input[name="edition"]').forEach(radio => {
  radio.addEventListener('change', () => selectEdition(Number(radio.value)))
})

// ============================================================
// BOOKING — cards de alojamiento sincronizadas con el radio
// ============================================================
function selectAccommodation(value) {
  document.querySelectorAll('.price-option').forEach(card => {
    const isSelected = card.dataset.accommodation === value
    card.classList.toggle('is-selected', isSelected)
    card.setAttribute('aria-checked', String(isSelected))
  })
  const radio = document.querySelector(`input[name="accommodation"][value="${value}"]`)
  if (radio && !radio.checked) radio.checked = true
}

document.querySelectorAll('.price-option').forEach(card => {
  card.addEventListener('click', () => selectAccommodation(card.dataset.accommodation))
})

document.querySelectorAll('input[name="accommodation"]').forEach(radio => {
  radio.addEventListener('change', () => selectAccommodation(radio.value))
})

// Inicializar según el radio marcado
const initialAccommodation = document.querySelector('input[name="accommodation"]:checked')
if (initialAccommodation) selectAccommodation(initialAccommodation.value)

// ============================================================
// BOOKING — formulario
// ============================================================
async function submitForm(e) {
  e.preventDefault()

  const form        = document.getElementById('booking-form')
  const errEl       = document.getElementById('form-error')
  const errEmailEl  = document.getElementById('form-error-email')
  const errAgeEl    = document.getElementById('form-error-age')
  const name        = form.name.value.trim()
  const email       = form.email.value.trim()
  const dob         = form.dob.value
  const country     = form.country.value
  const agree       = form.agree.checked

  if (!name || !email || !dob || !country || !agree) {
    errEl.hidden = false
    errEmailEl.hidden = true
    errAgeEl.hidden = true
    errEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    return
  }
  errEl.hidden = true

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    errEmailEl.hidden = false
    errEmailEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    return
  }
  errEmailEl.hidden = true

  const today     = new Date()
  const birthDate = new Date(dob)
  const age18     = new Date(birthDate.getFullYear() + 18, birthDate.getMonth(), birthDate.getDate())
  if (today < age18) {
    errAgeEl.hidden = false
    errAgeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    return
  }
  errAgeEl.hidden = true

  // Número completo con prefijo (ej. +34612345678); window.itiPhone viene del script inline.
  // Fallback defensivo: si utils.js de intl-tel-input aún no cargó, getNumber() puede devolver ""
  // aunque el input tenga valor. En ese caso, construimos manualmente: + dialCode + dígitos crudos.
  let phone = ''
  const rawInput = form.phone.value.trim()
  if (window.itiPhone) {
    try { phone = window.itiPhone.getNumber() || '' } catch (_) { phone = '' }
    if (!phone && rawInput) {
      const digits = rawInput.replace(/\D/g, '')
      let dialCode = ''
      try { dialCode = (window.itiPhone.getSelectedCountryData() || {}).dialCode || '' } catch (_) {}
      phone = digits ? (dialCode ? '+' + dialCode + digits : digits) : ''
    }
  } else {
    phone = rawInput
  }
  console.log('[JJL] phone a enviar:', phone)

  const edition       = form.edition.value
  const accommodation = form.accommodation.value
  const background    = form.background.value.trim()
  const howHeard      = form.howHeard.value

  const payload = { name, email, dob, country, phone, edition, accommodation, background, howHeard, consent: agree }

  const submitBtn = form.querySelector('button[type="submit"]')
  if (submitBtn) submitBtn.disabled = true

  const fallbackMsg = currentLang === 'es'
    ? 'Error al enviar. Inténtalo de nuevo en unos minutos.'
    : 'Submission failed. Please try again in a few minutes.'

  try {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      // Si la Lambda devolvió un error con mensaje legible, lo usamos en lugar del genérico
      let serverMsg = ''
      try {
        const data = await res.json()
        if (data && typeof data.error === 'string') serverMsg = data.error
      } catch (_) { /* respuesta no era JSON */ }
      const e = new Error(serverMsg || ('Error del servidor (' + res.status + ')'))
      e.fromServer = !!serverMsg
      throw e
    }
  } catch (err) {
    console.error('Error al enviar el formulario:', err)
    errEl.textContent = err && err.fromServer ? err.message : fallbackMsg
    errEl.hidden = false
    errEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    if (submitBtn) submitBtn.disabled = false
    return
  }

  form.hidden = true
  document.getElementById('form-intro').hidden = true
  document.getElementById('form-success').hidden = false
}

// ============================================================
// LOCATION SLIDESHOW
// ============================================================
;(function initLocationSlider() {
  const slider = document.querySelector('.location-slider')
  if (!slider) return
  const slides = slider.querySelectorAll('.lslider__slide')
  const dots   = slider.querySelectorAll('.lslider__dot')
  if (slides.length < 2) return

  let idx   = 0
  let timer = null

  function goTo(n) {
    slides[idx].classList.remove('is-active')
    dots[idx].classList.remove('is-active')
    idx = (n + slides.length) % slides.length
    slides[idx].classList.add('is-active')
    dots[idx].classList.add('is-active')
  }

  function startAuto() { timer = setInterval(() => goTo(idx + 1), 4500) }
  function resetAuto()  { clearInterval(timer); startAuto() }

  slider.querySelector('.lslider__btn--next').addEventListener('click', () => { goTo(idx + 1); resetAuto() })
  slider.querySelector('.lslider__btn--prev').addEventListener('click', () => { goTo(idx - 1); resetAuto() })
  dots.forEach(d => d.addEventListener('click', () => { goTo(Number(d.dataset.idx)); resetAuto() }))

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) startAuto()
})()

// ============================================================
// SCROLL ANIMATIONS — IntersectionObserver
// ============================================================
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible')
        observer.unobserve(entry.target)
      }
    })
  },
  { threshold: 0.12 }
)

document.querySelectorAll('.fade-in, .from-left, .from-right').forEach(el => {
  observer.observe(el)
})

// ============================================================
// HERO SLIDESHOW — crossfade automático entre imágenes
// ============================================================
;(function initHeroSlides() {
  const slides = document.querySelectorAll('.hero-slide')
  if (slides.length < 2) return

  // Respetar preferencia del sistema: si el usuario pidió menos movimiento, no rotar
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) return

  const INTERVAL_MS = 5500 // 5,5s por slide (incluye el cruce de 1,2s)
  let i = 0

  setInterval(() => {
    slides[i].classList.remove('is-active')
    i = (i + 1) % slides.length
    slides[i].classList.add('is-active')
  }, INTERVAL_MS)
})()

// ============================================================
// ARTISTAS — Ver más / Ver menos
// Por defecto la grid muestra solo los 3 primeros; el botón expande el resto.
// ============================================================
;(function initFacultyToggle() {
  const btn  = document.getElementById('faculty-toggle')
  const grid = document.getElementById('faculty-grid')
  if (!btn || !grid) return

  btn.addEventListener('click', () => {
    const willExpand = !grid.classList.contains('is-expanded')
    grid.classList.toggle('is-expanded', willExpand)
    btn.setAttribute('aria-expanded', String(willExpand))

    // Al colapsar, devolver el foco al principio de la sección para no dejar
    // al usuario perdido al final de una zona que se ha encogido.
    if (!willExpand) {
      const section = document.getElementById('artists')
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  })
})()
