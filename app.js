// ============================================================
// CONFIG — cuando tengas el backend, pon aquí la URL de tu API
// ============================================================
const CONFIG = {
  // API_URL: 'https://tu-api-id.execute-api.eu-west-1.amazonaws.com/prod'
  API_URL: null  // null = sin backend por ahora
}

// ============================================================
// ESTADO GLOBAL
// ============================================================
let currentLang = localStorage.getItem('jjl-lang') || 'es'

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

  const label = lang === 'es' ? '🇪🇸 ES | EN' : '🇬🇧 EN | ES'
  ;['lang-toggle-desktop', 'lang-toggle-mobile', 'lang-toggle-footer'].forEach(id => {
    const btn = document.getElementById(id)
    if (btn) btn.textContent = label
  })
}

function toggleLang() {
  applyLang(currentLang === 'es' ? 'en' : 'es')
}

document.getElementById('lang-toggle-desktop').addEventListener('click', toggleLang)
document.getElementById('lang-toggle-mobile').addEventListener('click', toggleLang)
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

// ============================================================
// BOOKING — formulario
// ============================================================
async function submitForm(e) {
  e.preventDefault()

  const form    = document.getElementById('booking-form')
  const errEl   = document.getElementById('form-error')
  const name    = form.name.value.trim()
  const email   = form.email.value.trim()
  const country = form.country.value
  const agree   = form.agree.checked

  if (!name || !email || !country || !agree) {
    errEl.hidden = false
    return
  }
  errEl.hidden = true

  const payload = { name, email, country }

  if (CONFIG.API_URL) {
    // ── CON BACKEND ──────────────────────────────────────────
    // Cuando conectes Lambda, descomenta este bloque:
    /*
    try {
      const res = await fetch(CONFIG.API_URL + '/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error('Error del servidor')
    } catch (err) {
      errEl.textContent = 'Error al enviar. Inténtalo de nuevo.'
      errEl.hidden = false
      return
    }
    */
  } else {
    // ── SIN BACKEND (modo actual) ─────────────────────────────
    console.log('Booking form (sin backend):', payload)
  }

  form.hidden = true
  document.getElementById('form-success').hidden = false
  applyLang(currentLang)
}

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
