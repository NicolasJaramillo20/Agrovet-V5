import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown, CircleUserRound,
  Download, Eye, Heart, Leaf, LogIn, Menu, Minus, Package, PawPrint, Plus, ShieldCheck, ShoppingBag,
  ShoppingCart, Sprout, Stethoscope, Trash2, Truck, Users, X,
} from 'lucide-react'
import { GoogleLogin } from '@react-oauth/google'
import { api } from './api'
import SitesManager from './components/SitesManager'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
const initialUser = () => {
  try { return JSON.parse(localStorage.getItem('agrovet-user')) } catch { return null }
}
const initialCart = () => {
  try { return JSON.parse(localStorage.getItem('agrovet-cart')) || [] } catch { return [] }
}
const money = (value) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
}).format(value || 0)
const shortDate = (value) => value ? new Date(value).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const productPlaceholder = 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=700&q=80'

function App() {
  const [user, setUser] = useState(initialUser)
  const [token, setToken] = useState(() => localStorage.getItem('agrovet-token'))
  const [page, setPage] = useState('inicio')
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState(initialCart)
  const [pets, setPets] = useState([])
  const [appointments, setAppointments] = useState([])
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [isCartOpen, setCartOpen] = useState(false)
  const [authMode, setAuthMode] = useState(() => new URLSearchParams(window.location.search).has('reset') ? 'reset' : '')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [productForm, setProductForm] = useState(null)
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('reset') || '')
  const [userForm, setUserForm] = useState(null)
  const [databaseStatus, setDatabaseStatus] = useState(null)
  const [relationalProducts, setRelationalProducts] = useState([])
  const [relationalCustomers, setRelationalCustomers] = useState([])
  const [invoices, setInvoices] = useState([])
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [cartPulse, setCartPulse] = useState(0)
  const isAdmin = user?.rol === 'admin'
  const cartCount = cart.reduce((total, item) => total + item.cantidad, 0)
  const cartTotal = useMemo(() => cart.reduce((total, item) => total + item.precio * item.cantidad, 0), [cart])

  const notify = useCallback((message) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3500)
  }, [])
  const loadProducts = useCallback(async () => {
    try {
      setProducts(await api(`/products${isAdmin ? '?all=true' : ''}`, { token }))
    } catch (error) {
      notify(error.message)
    }
  }, [isAdmin, notify, token])

  const loadAccount = useCallback(async () => {
    if (!token || !user) return
    try {
      const [petList, appointmentList] = await Promise.all([
        api('/pets', { token }),
        api('/appointments', { token }),
      ])
      setPets(petList)
      setAppointments(appointmentList)
      if (user.rol === 'admin') {
        const [statsData, userList, allAppointments, allPets] = await Promise.all([
          api('/admin/stats', { token }),
          api('/admin/users', { token }),
          api('/appointments?all=true', { token }),
          api('/pets?all=true', { token }),
        ])
        setStats(statsData)
        setUsers(userList)
        setAppointments(allAppointments)
        setPets(allPets)
        const statusData = await api('/relational/status', { token })
        setDatabaseStatus(statusData)
        const [productRows, customerRows, invoiceRows] = await Promise.all([
          statusData.postgresql.connected ? api('/relational/products', { token }) : Promise.resolve([]),
          statusData.postgresql.connected ? api('/relational/customers', { token }) : Promise.resolve([]),
          statusData.mysql.connected ? api('/relational/invoices', { token }) : Promise.resolve([]),
        ])
        setRelationalProducts(productRows)
        setRelationalCustomers(customerRows)
        setInvoices(invoiceRows)
      }
    } catch (error) {
      notify(error.message)
    }
  }, [notify, token, user])

  useEffect(() => {
    let active = true
    api(`/products${isAdmin ? '?all=true' : ''}`, { token })
      .then((result) => { if (active) setProducts(result) })
      .catch((error) => { if (active) notify(error.message) })
    return () => { active = false }
  }, [isAdmin, notify, token])
  useEffect(() => {
    if (!token || !user) return undefined
    let active = true
    async function refreshAccount() {
      try {
        const [petList, appointmentList] = await Promise.all([
          api('/pets', { token }),
          api('/appointments', { token }),
        ])
        if (!active) return
        setPets(petList)
        setAppointments(appointmentList)
        if (user.rol === 'admin') {
          const [statsData, userList, allAppointments, allPets] = await Promise.all([
            api('/admin/stats', { token }),
            api('/admin/users', { token }),
            api('/appointments?all=true', { token }),
            api('/pets?all=true', { token }),
          ])
          if (!active) return
          setStats(statsData)
          setUsers(userList)
          setAppointments(allAppointments)
          setPets(allPets)
          const statusData = await api('/relational/status', { token })
          setDatabaseStatus(statusData)
          const [productRows, customerRows, invoiceRows] = await Promise.all([
            statusData.postgresql.connected ? api('/relational/products', { token }) : Promise.resolve([]),
            statusData.postgresql.connected ? api('/relational/customers', { token }) : Promise.resolve([]),
            statusData.mysql.connected ? api('/relational/invoices', { token }) : Promise.resolve([]),
          ])
          if (!active) return
          setRelationalProducts(productRows)
          setRelationalCustomers(customerRows)
          setInvoices(invoiceRows)
        }
      } catch (error) {
        if (active) notify(error.message)
      }
    }
    refreshAccount()
    return () => { active = false }
  }, [notify, token, user])
  useEffect(() => { localStorage.setItem('agrovet-cart', JSON.stringify(cart)) }, [cart])

  function navigate(target) {
    setPage(target)
    setMobileMenu(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function updateCart(product, delta) {
    setCartPulse((current) => current + 1)
    setCart((current) => {
      const found = current.find((item) => item._id === product._id)
      if (!found && delta > 0) return [...current, { ...product, cantidad: 1 }]
      return current.map((item) => item._id === product._id
        ? { ...item, cantidad: Math.max(0, Math.min(item.stock, item.cantidad + delta)) }
        : item).filter((item) => item.cantidad > 0)
    })
  }

  async function submitAuth(event) {
    event.preventDefault()
    const form = Object.fromEntries(new FormData(event.currentTarget))
    setBusy(true)
    try {
      if (authMode === 'forgot') {
        const result = await api('/auth/password/forgot', { method: 'POST', body: JSON.stringify(form) })
        setAuthMode('login')
        notify(result.message)
        return
      }
      if (authMode === 'reset') {
        const result = await api('/auth/password/reset', {
          method: 'POST',
          body: JSON.stringify({ token: resetToken, password: form.password }),
        })
        setAuthMode('login')
        setResetToken('')
        window.history.replaceState({}, '', window.location.pathname)
        notify(result.message)
        return
      }
      const result = await api(authMode === 'register' ? '/auth/register' : '/auth/login', {
        method: 'POST', body: JSON.stringify(form),
      })
      setToken(result.token)
      setUser(result.user)
      localStorage.setItem('agrovet-token', result.token)
      localStorage.setItem('agrovet-user', JSON.stringify(result.user))
      setAuthMode('')
      notify(`¡Hola, ${result.user.nombre.split(' ')[0]}!`)
      if (result.user.rol === 'admin') navigate('admin')
    } catch (error) {
      notify(error.message)
    } finally { setBusy(false) }
  }

  async function submitGoogle(credential) {
    setBusy(true)
    try {
      const result = await api('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential }),
      })
      setToken(result.token)
      setUser(result.user)
      localStorage.setItem('agrovet-token', result.token)
      localStorage.setItem('agrovet-user', JSON.stringify(result.user))
      setAuthMode('')
      notify(`¡Hola, ${result.user.nombre.split(' ')[0]}!`)
      if (result.user.rol === 'admin') navigate('admin')
    } catch (error) {
      notify(error.message)
    } finally { setBusy(false) }
  }

  async function saveUser(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = Object.fromEntries(new FormData(formElement))
    Object.keys(form).forEach((key) => { if (!form[key]) delete form[key] })
    try {
      await api(`/admin/users/${userForm._id}`, { method: 'PUT', token, body: JSON.stringify(form) })
      setUserForm(null)
      await loadAccount()
      notify('Usuario actualizado.')
    } catch (error) {
      notify(error.message)
    }
  }

  function logout() {
    localStorage.removeItem('agrovet-token')
    localStorage.removeItem('agrovet-user')
    setToken(null)
    setUser(null)
    setPets([])
    setAppointments([])
    setStats(null)
    navigate('inicio')
    notify('Has cerrado sesión.')
  }

  async function checkout() {
    if (!user) {
      setCartOpen(false)
      setAuthMode('login')
      notify('Inicia sesión para finalizar tu compra.')
      return
    }
    setBusy(true)
    try {
      const result = await api('/orders', {
        method: 'POST', token,
        body: JSON.stringify({ items: cart.map(({ _id, cantidad }) => ({ id_producto: _id, cantidad })) }),
      })
      setCart([])
      setCartOpen(false)
      await loadProducts()
      notify(result.message || '¡Compra confirmada! Gracias por elegir AgroVet.')
    } catch (error) {
      notify(error.message)
      await loadProducts()
    } finally { setBusy(false) }
  }

  async function addPet(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = Object.fromEntries(new FormData(formElement))
    try {
      await api('/pets', { method: 'POST', token, body: JSON.stringify(form) })
      formElement.reset()
      await loadAccount()
      notify('Mascota registrada correctamente.')
    } catch (error) { notify(error.message) }
  }

  async function deletePet(id) {
    try {
      await api(`/pets/${id}`, { method: 'DELETE', token })
      await loadAccount()
      notify('Mascota eliminada.')
    } catch (error) { notify(error.message) }
  }

  async function addAppointment(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = Object.fromEntries(new FormData(formElement))
    try {
      await api('/appointments', { method: 'POST', token, body: JSON.stringify(form) })
      formElement.reset()
      await loadAccount()
      notify('Tu solicitud de cita fue enviada.')
    } catch (error) { notify(error.message) }
  }

  async function changeAppointment(id, estado) {
    try {
      await api(`/appointments/${id}/status`, { method: 'PATCH', token, body: JSON.stringify({ estado }) })
      await loadAccount()
      notify('Estado de cita actualizado.')
    } catch (error) { notify(error.message) }
  }

  async function saveProfile(event) {
    event.preventDefault()
    const form = Object.fromEntries(new FormData(event.currentTarget))
    if (!form.password) delete form.password
    try {
      const result = await api('/auth/profile', { method: 'PUT', token, body: JSON.stringify(form) })
      setUser(result.user)
      localStorage.setItem('agrovet-user', JSON.stringify(result.user))
      notify('Perfil actualizado.')
    } catch (error) { notify(error.message) }
  }

  async function saveProduct(event) {
    event.preventDefault()
    const formData = Object.fromEntries(new FormData(event.currentTarget))
    const payload = {
      ...formData,
      precio: Number(formData.precio),
      stock: Number(formData.stock),
      activo: formData.activo === undefined || formData.activo === 'true',
    }
    try {
      await api(productForm._id ? `/products/${productForm._id}` : '/products', {
        method: productForm._id ? 'PUT' : 'POST',
        token, body: JSON.stringify(payload),
      })
      setProductForm(null)
      await Promise.all([loadProducts(), loadAccount()])
      notify('Producto guardado.')
    } catch (error) { notify(error.message) }
  }

  async function productAction(id, action, body) {
    try {
      if (action === 'delete') await api(`/products/${id}`, { method: 'DELETE', token })
      else if (action === 'stock') await api(`/products/${id}/stock`, { method: 'PATCH', token, body: JSON.stringify({ cantidad: body }) })
      else await api(`/products/${id}/active`, { method: 'PATCH', token, body: JSON.stringify({ activo: body }) })
      await Promise.all([loadProducts(), loadAccount()])
      notify('Inventario actualizado.')
    } catch (error) { notify(error.message) }
  }

  async function manageUser(id, action, value) {
    try {
      if (action === 'delete') await api(`/admin/users/${id}`, { method: 'DELETE', token })
      else await api(`/admin/users/${id}/role`, { method: 'PATCH', token, body: JSON.stringify({ rol: value }) })
      await loadAccount()
      notify('Usuario actualizado.')
    } catch (error) { notify(error.message) }
  }

  async function saveRelationalRecord(kind, id, form) {
    try {
      const path = `/relational/${kind}${id ? `/${id}` : ''}`
      await api(path, { method: id ? 'PUT' : 'POST', token, body: JSON.stringify(form) })
      await loadAccount()
      notify(kind === 'products' ? 'Producto PostgreSQL guardado.' : 'Cliente PostgreSQL guardado.')
      return true
    } catch (error) {
      notify(error.message)
      return false
    }
  }

  async function deleteRelationalRecord(kind, id) {
    try {
      await api(`/relational/${kind}/${id}`, { method: 'DELETE', token })
      await loadAccount()
      notify(kind === 'products' ? 'Producto PostgreSQL eliminado.' : 'Cliente PostgreSQL eliminado.')
    } catch (error) {
      notify(error.message)
    }
  }

  const navLinks = [['inicio', 'Inicio'], ['nosotros', 'Nosotros'], ['productos', 'Productos'], ['contacto', 'Contacto']]
  const productCards = products.filter((product) => product.activo)

  return (
    <div className="min-h-screen bg-[#f8faf7]">
      <div className="hidden border-b border-[#e9eee8] bg-[#f1f5ef] sm:block">
        <div className="page-width flex h-9 items-center justify-between text-[11px] font-medium text-[#68766b]">
          <span className="flex items-center gap-2"><Truck size={13} /> Envíos a todo Colombia</span>
          <span>El bienestar animal, en el corazón de todo lo que hacemos.</span>
          <span className="flex items-center gap-1"><ShieldCheck size={13} /> Atención veterinaria confiable</span>
        </div>
      </div>
      <header className="sticky top-0 z-30 border-b border-[#edf0eb] bg-[#fbfcfa]/95 backdrop-blur-md">
        <div className="page-width flex h-[76px] items-center justify-between gap-5">
          <button onClick={() => navigate('inicio')} className="flex items-center gap-2.5 text-left" aria-label="AgroVet, ir al inicio">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#286541] text-white"><Sprout size={22} strokeWidth={2.2} /></span>
            <span><span className="block text-[19px] font-extrabold leading-5 tracking-[-.06em] text-[#21372a]">agrovet</span><span className="text-[9px] font-semibold uppercase tracking-[.19em] text-[#819087]">cuidado que crece</span></span>
          </button>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Navegación principal">
            {navLinks.map(([key, label]) => <button key={key} onClick={() => navigate(key)} className={`nav-link ${page === key ? 'active' : ''}`}>{label}</button>)}
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <button onClick={() => navigate(isAdmin ? 'admin' : 'cuenta')} className="hidden items-center gap-2 rounded-full border border-[#e5ebe4] bg-white py-2 pl-2 pr-3 text-xs font-semibold text-[#314238] sm:flex">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#edf4ec] text-[#39734c]"><CircleUserRound size={17} /></span>
                <span>{user.nombre.split(' ')[0]}</span><ChevronDown size={13} />
              </button>
            ) : <button onClick={() => setAuthMode('login')} className="hidden items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#526258] sm:flex"><LogIn size={15} /> Ingresar</button>}
            <button onClick={() => setCartOpen(true)} className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#e5ebe4] bg-white text-[#34523c]" aria-label={`Carrito, ${cartCount} productos`}>
              <ShoppingCart key={cartPulse} size={18} className={cartPulse ? 'cart-bump' : ''} />
              {cartCount > 0 && <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ce764b] px-1 text-[10px] font-bold text-white">{cartCount}</span>}
            </button>
            <button onClick={() => setMobileMenu(!mobileMenu)} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e5ebe4] bg-white md:hidden" aria-label="Abrir menú"><Menu size={19} /></button>
          </div>
        </div>
        {mobileMenu && <div className="border-t border-[#edf0eb] bg-white px-5 py-3 md:hidden">{navLinks.map(([key, label]) => <button key={key} onClick={() => navigate(key)} className="block w-full py-3 text-left text-sm font-medium text-[#526258]">{label}</button>)}{user ? <button onClick={() => navigate(isAdmin ? 'admin' : 'cuenta')} className="block w-full py-3 text-left text-sm font-semibold text-forest-600">Mi cuenta</button> : <button onClick={() => { setMobileMenu(false); setAuthMode('login') }} className="block w-full py-3 text-left text-sm font-semibold text-forest-600">Ingresar / Crear cuenta</button>}</div>}
      </header>

      <main>
        {page === 'inicio' && <HomePage navigate={navigate} openAuth={() => setAuthMode('login')} products={productCards.slice(0, 3)} addToCart={updateCart} />}
        {page === 'nosotros' && <AboutPage navigate={navigate} />}
        {page === 'productos' && <CatalogPage products={productCards} addToCart={updateCart} />}
        {page === 'contacto' && <ContactPage notify={notify} />}
        {page === 'cuenta' && (user
          ? <AccountPage user={user} token={token} notify={notify} pets={pets} appointments={appointments} onAddPet={addPet} onDeletePet={deletePet} onAddAppointment={addAppointment} onSaveProfile={saveProfile} onLogout={logout} />
          : <SignInPrompt onLogin={() => setAuthMode('login')} />)}
        {page === 'admin' && (isAdmin
          ? <AdminPage stats={stats} products={products} appointments={appointments} users={users} databaseStatus={databaseStatus} relationalProducts={relationalProducts} relationalCustomers={relationalCustomers} invoices={invoices} onEditUser={setUserForm} onEditProduct={setProductForm} onProductAction={productAction} onChangeAppointment={changeAppointment} onManageUser={manageUser} onSaveRelationalRecord={saveRelationalRecord} onDeleteRelationalRecord={deleteRelationalRecord} onLogout={logout} />
          : <SignInPrompt onLogin={() => setAuthMode('login')} admin />)}
      </main>

      <Footer navigate={navigate} />

      {isCartOpen && <CartDrawer cart={cart} total={cartTotal} onClose={() => setCartOpen(false)} onQuantity={updateCart} onClear={() => setCart([])} onCheckout={checkout} busy={busy} />}
      {authMode && <AuthModal mode={authMode} setMode={setAuthMode} onClose={() => setAuthMode('')} onSubmit={submitAuth} onGoogle={(credential) => submitGoogle(credential)} onGoogleError={() => notify('No se pudo iniciar sesión con Google. Inténtalo nuevamente.')} busy={busy} />}
      {productForm && <ProductModal product={productForm} onClose={() => setProductForm(null)} onSave={saveProduct} />}
      {userForm && <UserModal person={userForm} onClose={() => setUserForm(null)} onSave={saveUser} />}
      {notice && <div role="status" className="fixed bottom-5 left-1/2 z-[70] flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-2 rounded-2xl bg-[#203b2a] px-5 py-3 text-sm font-medium text-white shadow-xl"><Check size={16} className="shrink-0 text-[#b5d3a9]" />{notice}</div>}
    </div>
  )
}

function HomePage({ navigate, openAuth, products, addToCart }) {
  return <>
    <section className="relative overflow-hidden bg-[#eff4ed]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_74%_54%,rgba(201,218,191,.55),transparent_42%)]" />
      <div className="page-width relative grid min-h-[570px] items-center gap-8 py-12 md:grid-cols-[.94fr_1.06fr] md:py-16">
        <div className="z-10 max-w-[510px]">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#dbe7d9] bg-white/70 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[.12em] text-[#52735c]"><span className="h-1.5 w-1.5 rounded-full bg-[#75a56d]" /> Cuidamos lo que te mueve</div>
          <h1 className="serif mb-5 text-[48px] leading-[1.05] text-[#1f3829] sm:text-[62px]">El bienestar animal<br /><span className="italic text-[#4c8059]">crece aquí.</span></h1>
          <p className="max-w-[420px] text-[15px] leading-7 text-[#6b796e]">Todo lo que necesitas para cuidar a tus animales: atención veterinaria cercana y productos seleccionados para cada etapa.</p>
          <div className="mt-8 flex flex-wrap gap-3"><button onClick={() => navigate('productos')} className="btn-primary">Explorar productos <ArrowRight size={16} /></button><button onClick={openAuth} className="btn-secondary">Agenda una cita <CalendarDays size={15} /></button></div>
          <div className="mt-11 flex items-center gap-4 border-t border-[#dce6da] pt-5">
            <div className="flex -space-x-2">{['photo-1548199973-03cce0bbc87b', 'photo-1551717743-49959800b1f6', 'photo-1524024973431-2ad916746881'].map((photo) => <img key={photo} src={`https://images.unsplash.com/${photo}?auto=format&fit=crop&w=80&q=75`} className="h-8 w-8 rounded-full border-2 border-[#eff4ed] object-cover" alt="" />)}</div>
            <div><p className="text-[11px] font-bold text-[#3e5646]">Una comunidad que confía</p><p className="mt-0.5 text-[10px] text-[#859187]">Cuidado con propósito, todos los días.</p></div>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-[560px]">
          <div className="absolute -right-7 top-8 h-44 w-44 rounded-full border border-[#d8e5d4] md:h-64 md:w-64" />
          <div className="relative h-[330px] overflow-hidden rounded-[30px] bg-[#d7e3d1] sm:h-[430px]">
            <img className="h-full w-full object-cover object-center" src="https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&w=1200&q=85" alt="Animales de campo pastando en un paisaje verde" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#203a2b]/35 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between rounded-2xl border border-white/40 bg-white/85 p-4 backdrop-blur-md">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f0e5] text-[#3f7450]"><Stethoscope size={19} /></span><div><p className="text-xs font-bold text-[#293e30]">Cuidado integral</p><p className="mt-1 text-[10px] text-[#7b887e]">Para los animales que amas</p></div></div><ArrowUpRight size={18} className="text-[#597762]" />
            </div>
          </div>
          <div className="absolute -left-5 top-8 hidden items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-[11px] font-semibold text-[#44634b] soft-shadow sm:flex"><Heart size={15} className="fill-[#d8795a] text-[#d8795a]" /> Hecho con cariño</div>
        </div>
      </div>
    </section>
    <section className="page-width py-16">
      <div className="mb-8 flex items-end justify-between gap-4"><div><p className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#78907c]">Lo mejor para ellos</p><h2 className="serif text-3xl text-[#263d2e]">Cuidado que se nota</h2></div><button onClick={() => navigate('productos')} className="hidden items-center gap-2 text-xs font-bold text-[#39734c] sm:flex">Ver catálogo <ArrowRight size={15} /></button></div>
      {products.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => <ProductCard key={product._id} product={product} addToCart={addToCart} />)}</div> : <div className="panel-card flex min-h-44 flex-col items-center justify-center text-center"><Package size={28} className="mb-2 text-[#91a895]" /><p className="text-sm font-semibold text-[#4e6153]">Pronto encontrarás aquí nuestros productos.</p><p className="mt-1 text-xs text-[#8b978d]">Estamos preparando una selección especial para tus animales.</p></div>}
      <button onClick={() => navigate('productos')} className="btn-secondary mt-5 w-full sm:hidden">Ver catálogo <ArrowRight size={15} /></button>
    </section>
    <section className="bg-white py-14"><div className="page-width grid gap-8 md:grid-cols-3">{[[Stethoscope, 'Acompañamiento veterinario', 'Profesionales comprometidos con la salud y bienestar de tus animales.'], [Leaf, 'Productos seleccionados', 'Alimentación, cuidado y bienestar con calidad para cada especie.'], [Heart, 'Cercanía en cada paso', 'Estamos aquí para ayudarte a tomar las mejores decisiones.']].map(([Icon, title, copy]) => <div key={title} className="flex gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#f0f5ee] text-[#477852]"><Icon size={20} /></span><div><h3 className="mb-1 text-sm font-bold text-[#354a3a]">{title}</h3><p className="text-xs leading-5 text-[#7b887e]">{copy}</p></div></div>)}</div></section>
  </>
}

function ProductCard({ product, addToCart }) {
  const [justAdded, setJustAdded] = useState(false)
  const feedbackTimeout = useRef(null)
  const stockClass = product.stock === 0 ? 'bg-[#fce9e5] text-[#b55e4d]' : product.stock < 6 ? 'bg-[#fff3d6] text-[#a27420]' : 'bg-[#edf5ea] text-[#4c8053]'
  const stockLabel = product.stock === 0 ? 'Agotado' : product.stock < 6 ? 'Últimas unidades' : 'Disponible'
  useEffect(() => () => window.clearTimeout(feedbackTimeout.current), [])
  function handleAdd() {
    addToCart(product, 1)
    setJustAdded(true)
    window.clearTimeout(feedbackTimeout.current)
    feedbackTimeout.current = window.setTimeout(() => setJustAdded(false), 800)
  }
  return <article className="panel-card group overflow-hidden transition hover:-translate-y-1 hover:shadow-lg">
    <div className="product-image relative h-[205px] overflow-hidden">
      <img src={product.imagen || productPlaceholder} onError={(event) => { event.currentTarget.src = productPlaceholder }} alt={product.nombre_producto} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
      <span className={`badge absolute left-3 top-3 ${stockClass}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{stockLabel}</span>
    </div>
    <div className="p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-[#314238]">{product.nombre_producto}</h3><p className="mt-1 line-clamp-2 min-h-9 text-xs leading-5 text-[#849087]">{product.descripcion || 'Cuidado de calidad para tus animales.'}</p></div></div>
      <div className="mt-4 flex items-center justify-between border-t border-[#f0f2ef] pt-3"><span className="text-base font-extrabold text-[#2a5737]">{money(product.precio)}</span><button onClick={handleAdd} disabled={product.stock < 1} className={`flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#286541] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 ${justAdded ? 'bg-[#286541] text-white' : 'bg-[#edf4eb] text-[#367148]'}`} aria-label={justAdded ? `${product.nombre_producto} agregado al carrito` : `Agregar ${product.nombre_producto} al carrito`}><span key={justAdded ? 'added' : 'add'} className={justAdded ? 'cart-add-feedback' : ''}>{justAdded ? <Check size={17} /> : <Plus size={17} />}</span></button></div>
    </div>
  </article>
}

function CatalogPage({ products, addToCart }) {
  const [search, setSearch] = useState('')
  const filtered = products.filter((product) => `${product.nombre_producto} ${product.descripcion}`.toLowerCase().includes(search.toLowerCase()))
  return <section className="page-width min-h-[65vh] py-12 md:py-16">
    <p className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#78907c]">Tienda AgroVet</p>
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><h1 className="serif text-4xl text-[#263d2e]">Lo mejor para su bienestar.</h1><p className="mt-2 text-sm text-[#7a887d]">Productos seleccionados para cuidar a cada uno de tus animales.</p></div><input value={search} onChange={(event) => setSearch(event.target.value)} className="input-field max-w-[290px]" placeholder="Buscar productos..." aria-label="Buscar productos" /></div>
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((product) => <ProductCard key={product._id} product={product} addToCart={addToCart} />)}</div>
    {!filtered.length && <div className="panel-card mt-8 flex flex-col items-center py-16 text-center"><ShoppingBag size={28} className="mb-3 text-[#96aa98]" /><h2 className="text-base font-bold text-[#425448]">{search ? 'No encontramos productos' : 'Estamos preparando el catálogo'}</h2><p className="mt-2 max-w-sm text-sm text-[#87938a]">{search ? 'Prueba con otro término de búsqueda.' : 'Muy pronto encontrarás productos de calidad para tus animales.'}</p></div>}
  </section>
}

function AboutPage({ navigate }) {
  const values = [['Cuidado', 'El bienestar animal es la base de cada decisión.'], ['Confianza', 'Relaciones honestas con quienes nos eligen.'], ['Compromiso', 'Cercanía y responsabilidad en cada servicio.'], ['Calidad', 'Productos y atención seleccionados con criterio.']]
  return <section className="page-width py-12 md:py-16">
    <div className="grid items-center gap-10 md:grid-cols-2"><div><p className="mb-3 text-[11px] font-bold uppercase tracking-[.18em] text-[#78907c]">Quiénes somos</p><h1 className="serif text-5xl leading-tight text-[#263d2e]">Cuidar de ellos es cuidar de <span className="italic text-[#52845c]">todo.</span></h1><p className="mt-5 max-w-lg text-sm leading-7 text-[#78867b]">AgroVet nace de una convicción sencilla: cuando los animales están bien, nuestras familias, comunidades y campos también lo están. Somos tu aliado para cuidar su salud y bienestar.</p><button onClick={() => navigate('contacto')} className="btn-primary mt-7">Conócenos <ArrowRight size={15} /></button></div><div className="h-[340px] overflow-hidden rounded-[28px] bg-[#e7eee4]"><img src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1100&q=85" alt="Paisaje verde del campo" className="h-full w-full object-cover" /></div></div>
    <div className="mt-16 grid gap-8 border-y border-[#e6ece4] py-10 md:grid-cols-2"><div className="pr-4"><span className="badge bg-[#edf4eb] text-[#49734e]">Nuestra misión</span><h2 className="serif mt-4 text-3xl text-[#314739]">Acompañar a quienes cuidan.</h2><p className="mt-3 text-sm leading-6 text-[#77857a]">Facilitar el acceso a servicios veterinarios cercanos y productos confiables, poniendo siempre en primer lugar la salud de los animales.</p></div><div><span className="badge bg-[#edf4eb] text-[#49734e]">Nuestra visión</span><h2 className="serif mt-4 text-3xl text-[#314739]">Un campo más sano y próspero.</h2><p className="mt-3 text-sm leading-6 text-[#77857a]">Ser una comunidad referente en bienestar animal, creciendo junto a las personas que trabajan por un futuro mejor.</p></div></div>
    <div className="py-12"><h2 className="serif mb-7 text-center text-3xl text-[#314739]">Lo que nos guía</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{values.map(([title, copy]) => <div key={title} className="panel-card p-5"><span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf4eb] text-[#477852]"><Leaf size={17} /></span><h3 className="text-sm font-bold">{title}</h3><p className="mt-2 text-xs leading-5 text-[#7b887e]">{copy}</p></div>)}</div></div>
  </section>
}

function ContactPage({ notify }) {
  function submit(event) {
    event.preventDefault()
    event.currentTarget.reset()
    notify('Gracias por escribirnos. Nos pondremos en contacto contigo pronto.')
  }
  return <section className="page-width min-h-[65vh] py-12 md:py-16">
    <div className="mx-auto max-w-[820px]"><p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[.18em] text-[#78907c]">Estamos para ayudarte</p><h1 className="serif text-center text-4xl text-[#263d2e]">Hablemos de lo que necesitas.</h1><p className="mx-auto mt-3 max-w-lg text-center text-sm text-[#7a887d]">Cuéntanos cómo podemos acompañarte en el cuidado de tus animales.</p>
      <div className="mt-9 grid gap-6 md:grid-cols-[.8fr_1.2fr]"><div className="rounded-[22px] bg-[#244c32] p-6 text-white"><h2 className="serif text-2xl">Conversemos</h2><p className="mt-2 text-xs leading-5 text-white/65">Nuestro equipo está listo para orientarte.</p><div className="mt-8 space-y-5 text-xs"><p><span className="mb-1 block font-bold text-white/50">ESCRÍBENOS</span>hola@agrovet.co</p><p><span className="mb-1 block font-bold text-white/50">LLÁMANOS</span>+57 300 000 0000</p><p><span className="mb-1 block font-bold text-white/50">HORARIO</span>Lunes a sábado · 8:00 a. m. – 6:00 p. m.</p><p><span className="mb-1 block font-bold text-white/50">COBERTURA</span>Colombia</p></div></div>
        <form onSubmit={submit} className="panel-card grid gap-4 p-6 sm:grid-cols-2"><label><span className="label">Tu nombre</span><input required name="nombre" className="input-field" placeholder="Nombre completo" /></label><label><span className="label">Correo</span><input required type="email" name="correo" className="input-field" placeholder="tu@correo.com" /></label><label className="sm:col-span-2"><span className="label">¿En qué podemos ayudarte?</span><select name="motivo" className="input-field"><option>Consulta veterinaria</option><option>Productos y pedidos</option><option>Otro</option></select></label><label className="sm:col-span-2"><span className="label">Mensaje</span><textarea required name="mensaje" rows="4" className="input-field resize-y" placeholder="Escribe tu mensaje..." /></label><button className="btn-primary w-fit">Enviar mensaje <ArrowRight size={15} /></button></form>
      </div>
    </div>
  </section>
}

function SignInPrompt({ onLogin, admin = false }) {
  return <section className="page-width flex min-h-[60vh] flex-col items-center justify-center text-center"><span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf4eb] text-[#43744e]"><CircleUserRound size={26} /></span><h1 className="serif text-3xl text-[#2c4333]">{admin ? 'Acceso de administración' : 'Tu espacio AgroVet'}</h1><p className="mt-2 max-w-sm text-sm leading-6 text-[#7b887e]">Inicia sesión para gestionar tu cuenta y continuar disfrutando de nuestros servicios.</p><button onClick={onLogin} className="btn-primary mt-6">Iniciar sesión <ArrowRight size={15} /></button></section>
}

function AccountPage({ user, token, notify, pets, appointments, onAddPet, onDeletePet, onAddAppointment, onSaveProfile, onLogout }) {
  const species = ['Bovino', 'Equino', 'Porcino', 'Avícola', 'Canino', 'Felino', 'Ovino', 'Caprino', 'Otro']
  return <section className="page-width min-h-[70vh] py-10">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#78907c]">Mi espacio AgroVet</p><h1 className="serif text-4xl text-[#263d2e]">Hola, {user.nombre.split(' ')[0]}.</h1><p className="mt-2 text-sm text-[#7b887e]">Todo lo que necesitas para cuidar de tus animales.</p></div><button onClick={onLogout} className="btn-secondary">Cerrar sesión</button></div>
    <div className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <SitesManager token={token} notify={notify} />
      <div className="space-y-5">
        <div className="panel-card p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-bold text-[#33483a]">Mis animales</h2><p className="mt-1 text-xs text-[#87938a]">Su bienestar empieza por conocerlos.</p></div><span className="badge bg-[#edf4eb] text-[#49734e]">{pets.length} registrados</span></div>
          <form onSubmit={onAddPet} className="grid gap-3 rounded-2xl bg-[#f7f9f6] p-4 sm:grid-cols-2"><label><span className="label">Nombre</span><input required name="nombre_mascota" className="input-field" placeholder="Ej. Luna" /></label><label><span className="label">Especie</span><select required name="especie" className="input-field">{species.map((option) => <option key={option}>{option}</option>)}</select></label><label><span className="label">Raza</span><input name="raza" className="input-field" placeholder="Opcional" /></label><label><span className="label">Edad (años)</span><input type="number" min="0" name="edad" className="input-field" placeholder="0" /></label><label><span className="label">Peso (kg)</span><input type="number" min="0" step="0.1" name="peso" className="input-field" placeholder="0" /></label><label><span className="label">Sexo</span><select name="sexo" className="input-field"><option>No especificado</option><option>Macho</option><option>Hembra</option></select></label><button className="btn-primary w-fit sm:col-span-2"><Plus size={15} /> Registrar animal</button></form>
          <div className="mt-4 space-y-2">{pets.map((pet) => <div key={pet._id} className="flex items-center justify-between rounded-xl border border-[#edf0eb] px-4 py-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f0f5ee] text-[#4c7c53]"><PawPrint size={17} /></span><div><p className="text-sm font-semibold text-[#3b4e40]">{pet.nombre_mascota}</p><p className="text-[11px] text-[#89948b]">{pet.especie}{pet.raza ? ` · ${pet.raza}` : ''}{pet.id_usuario?.nombre ? ` · ${pet.id_usuario.nombre}` : ''}</p></div></div><button onClick={() => onDeletePet(pet._id)} className="p-2 text-[#a0aaa2] hover:text-[#bd5b4b]" aria-label={`Eliminar ${pet.nombre_mascota}`}><Trash2 size={16} /></button></div>)}{!pets.length && <p className="py-3 text-center text-xs text-[#8a968c]">Aún no has registrado animales.</p>}</div>
        </div>
        <div className="panel-card p-5"><h2 className="text-base font-bold text-[#33483a]">Mis citas</h2><div className="mt-4 space-y-3">{appointments.map((appointment) => <AppointmentRow key={appointment._id} appointment={appointment} />)}{!appointments.length && <p className="py-3 text-center text-xs text-[#8a968c]">No tienes citas agendadas.</p>}</div></div>
      </div>
      <div className="space-y-5">
        <form onSubmit={onAddAppointment} className="panel-card p-5"><div className="mb-4"><h2 className="text-base font-bold text-[#33483a]">Agendar cita</h2><p className="mt-1 text-xs text-[#87938a]">Cuéntanos cómo podemos ayudar.</p></div><div className="space-y-3"><label><span className="label">Animal</span><select required name="id_mascota" className="input-field" defaultValue="">{pets.filter((pet) => pet.id_usuario?._id === user._id || !pet.id_usuario).map((pet) => <option key={pet._id} value={pet._id}>{pet.nombre_mascota} · {pet.especie}</option>)}</select></label><label><span className="label">Servicio</span><select name="servicio" className="input-field"><option>Consulta general</option><option>Vacunación</option><option>Desparasitación</option><option>Control y seguimiento</option><option>Otro</option></select></label><div className="grid grid-cols-2 gap-3"><label><span className="label">Fecha</span><input required type="date" name="fecha" min={new Date().toISOString().slice(0, 10)} className="input-field" /></label><label><span className="label">Hora</span><input required type="time" name="hora" className="input-field" /></label></div><label><span className="label">Observaciones</span><textarea name="observaciones" rows="2" className="input-field resize-y" placeholder="Cuéntanos un poco más..." /></label><button disabled={!pets.length} className="btn-primary w-full disabled:opacity-50"><CalendarDays size={15} /> Solicitar cita</button></div></form>
        <form onSubmit={onSaveProfile} className="panel-card p-5"><h2 className="mb-4 text-base font-bold text-[#33483a]">Mi perfil</h2><div className="space-y-3"><label><span className="label">Nombre</span><input required name="nombre" defaultValue={user.nombre} className="input-field" /></label><label><span className="label">Correo</span><input disabled value={user.correo} className="input-field bg-[#f6f7f5] text-[#89948b]" /></label><label><span className="label">Teléfono</span><input name="telefono" defaultValue={user.telefono} className="input-field" /></label><label><span className="label">Dirección</span><input name="direccion" defaultValue={user.direccion} className="input-field" /></label><label><span className="label">Nueva contraseña <span className="font-normal text-[#9aa39c]">(opcional)</span></span><input type="password" minLength="8" name="password" className="input-field" placeholder="Al menos 8 caracteres" /></label><button className="btn-secondary w-full">Guardar cambios</button></div></form>
      </div>
    </div>
  </section>
}

function AppointmentRow({ appointment, admin = false, onChange }) {
  const statusStyles = { pendiente: 'bg-[#fff3d6] text-[#a27420]', confirmada: 'bg-[#eaf0fb] text-[#536ea1]', completada: 'bg-[#edf5ea] text-[#4c8053]', cancelada: 'bg-[#fce9e5] text-[#b55e4d]' }
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#edf0eb] px-4 py-3">
    <div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-[#3b4e40]">{appointment.servicio}</p><span className={`badge ${statusStyles[appointment.estado] || statusStyles.pendiente}`}>{appointment.estado}</span></div><p className="mt-1 text-[11px] text-[#89948b]">{admin ? `${appointment.id_usuario?.nombre || 'Usuario'} · ` : ''}{appointment.id_mascota?.nombre_mascota || 'Mascota'} · {shortDate(appointment.fecha)} · {appointment.hora}</p></div>
    {admin && <select value={appointment.estado} onChange={(event) => onChange(appointment._id, event.target.value)} className="rounded-lg border border-[#e5ebe4] bg-white px-2 py-2 text-xs text-[#58675c]"><option value="pendiente">Pendiente</option><option value="confirmada">Confirmada</option><option value="completada">Completada</option><option value="cancelada">Cancelada</option></select>}
  </div>
}

function AdminPage({
  stats, products, appointments, users, databaseStatus, relationalProducts, relationalCustomers,
  invoices, onEditUser, onEditProduct, onProductAction, onChangeAppointment, onManageUser,
  onSaveRelationalRecord, onDeleteRelationalRecord, onLogout,
}) {
  const cards = [['Usuarios', stats?.usuarios, Users], ['Mascotas', stats?.mascotas, PawPrint], ['Citas pendientes', stats?.citasPendientes, CalendarDays], ['Productos', stats?.productos, Package]]
  return <section className="page-width min-h-[70vh] py-10">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#78907c]">Panel de administración</p><h1 className="serif text-4xl text-[#263d2e]">Centro de gestión.</h1><p className="mt-2 text-sm text-[#7b887e]">Información y actividad de tu comunidad AgroVet.</p></div><button onClick={onLogout} className="btn-secondary">Cerrar sesión</button></div>
    <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([label, count, Icon]) => <div key={label} className="panel-card flex items-center gap-3 p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf4eb] text-[#477852]"><Icon size={18} /></span><div><p className="text-xl font-extrabold text-[#34493a]">{count ?? '—'}</p><p className="text-[11px] text-[#829087]">{label}</p></div></div>)}</div>
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <section className="panel-card p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-bold text-[#33483a]">Productos</h2><p className="mt-1 text-xs text-[#87938a]">Administra catálogo y existencias.</p></div><button onClick={() => onEditProduct({ nombre_producto: '', descripcion: '', precio: '', stock: 0, imagen: '', activo: true })} className="btn-primary px-4 py-2.5"><Plus size={15} /> Nuevo</button></div>
        <div className="space-y-2">{products.map((product) => <div key={product._id} className={`flex items-center gap-3 rounded-xl border border-[#edf0eb] p-3 ${!product.activo ? 'opacity-55' : ''}`}><img src={product.imagen || productPlaceholder} onError={(event) => { event.currentTarget.src = productPlaceholder }} className="h-12 w-12 rounded-lg object-cover" alt="" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-[#3b4e40]">{product.nombre_producto}</p><p className="mt-1 text-[10px] text-[#89948b]">{money(product.precio)} · Stock: {product.stock}{!product.activo ? ' · Inactivo' : ''}</p></div><div className="flex items-center gap-1"><button onClick={() => onProductAction(product._id, 'stock', -1)} className="rounded-md border border-[#e6ebe5] p-1.5 text-[#64756a]" aria-label="Disminuir stock"><Minus size={13} /></button><button onClick={() => onProductAction(product._id, 'stock', 1)} className="rounded-md border border-[#e6ebe5] p-1.5 text-[#64756a]" aria-label="Aumentar stock"><Plus size={13} /></button><button onClick={() => onEditProduct(product)} className="rounded-md px-2 py-1.5 text-[10px] font-bold text-[#4a7952]">Editar</button><button onClick={() => onProductAction(product._id, 'active', !product.activo)} className="rounded-md px-1 py-1.5 text-[10px] font-bold text-[#6c7d70]">{product.activo ? 'Ocultar' : 'Activar'}</button><button onClick={() => { if (window.confirm(`¿Eliminar ${product.nombre_producto}?`)) onProductAction(product._id, 'delete') }} className="p-1.5 text-[#ad766e]" aria-label="Eliminar producto"><Trash2 size={14} /></button></div></div>)}{!products.length && <p className="py-8 text-center text-xs text-[#87938a]">Aún no hay productos. Añade el primero.</p>}</div>
      </section>
      <section className="panel-card p-5"><div className="mb-4"><h2 className="text-base font-bold text-[#33483a]">Citas veterinarias</h2><p className="mt-1 text-xs text-[#87938a]">Revisa y actualiza las solicitudes.</p></div><div className="space-y-2">{appointments.map((appointment) => <AppointmentRow key={appointment._id} appointment={appointment} admin onChange={onChangeAppointment} />)}{!appointments.length && <p className="py-8 text-center text-xs text-[#87938a]">No hay citas por gestionar.</p>}</div></section>
      <section className="panel-card p-5 lg:col-span-2"><div className="mb-4"><h2 className="text-base font-bold text-[#33483a]">Usuarios registrados</h2><p className="mt-1 text-xs text-[#87938a]">Gestiona los perfiles de tu comunidad.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left"><thead><tr className="border-b border-[#edf0eb] text-[10px] uppercase tracking-wider text-[#909a92]"><th className="pb-3 font-semibold">Usuario</th><th className="pb-3 font-semibold">Registro</th><th className="pb-3 font-semibold">Rol</th><th className="pb-3 text-right font-semibold">Acciones</th></tr></thead><tbody>{users.map((person) => <tr key={person._id} className="border-b border-[#f2f4f1] last:border-0"><td className="py-3"><p className="text-xs font-semibold text-[#3b4e40]">{person.nombre}</p><p className="text-[10px] text-[#89948b]">{person.correo}</p></td><td className="py-3 text-xs text-[#7e8a80]">{shortDate(person.fecha_registro)}</td><td className="py-3"><span className={`badge ${person.rol === 'admin' ? 'bg-[#edf4eb] text-[#49734e]' : 'bg-[#f1f3f0] text-[#78847a]'}`}>{person.rol}</span></td><td className="py-3 text-right"><button onClick={() => onEditUser(person)} className="mr-2 rounded-lg border border-[#e5ebe4] px-2 py-1.5 text-[10px] font-bold text-[#4a7952]">Editar</button><select value={person.rol} onChange={(event) => onManageUser(person._id, 'role', event.target.value)} className="mr-2 rounded-lg border border-[#e5ebe4] bg-white px-2 py-1.5 text-[10px]"><option value="usuario">Usuario</option><option value="admin">Admin</option></select><button onClick={() => { if (window.confirm(`¿Eliminar la cuenta de ${person.nombre}?`)) onManageUser(person._id, 'delete') }} className="rounded-lg border border-[#f0ddda] px-2 py-1.5 text-[10px] font-bold text-[#b45e51]">Eliminar</button></td></tr>)}</tbody></table></div></section>
      <DatabaseManager status={databaseStatus} products={relationalProducts} customers={relationalCustomers} invoices={invoices} onSave={onSaveRelationalRecord} onDelete={onDeleteRelationalRecord} />
    </div>
  </section>
}

function DatabaseManager({ status, products, customers, invoices, onSave, onDelete }) {
  const [editor, setEditor] = useState(null)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const postgres = status?.postgresql
  const mysql = status?.mysql
  const connectionBadge = (database) => database?.connected
    ? 'bg-[#edf5ea] text-[#4c8053]'
    : database?.configured
      ? 'bg-[#fce9e5] text-[#b55e4d]'
      : 'bg-[#fff3d6] text-[#a27420]'
  const connectionLabel = (database) => database?.connected
    ? 'Conectada'
    : database?.configured
      ? 'Sin conexión'
      : 'Pendiente de configurar'

  async function submit(event) {
    event.preventDefault()
    const form = Object.fromEntries(new FormData(event.currentTarget))
    if (editor.kind === 'products') {
      form.precio = Number(form.precio)
      form.stock = Number(form.stock)
    }
    if (await onSave(editor.kind, editor.record?.id, form)) setEditor(null)
  }

  return <section className="panel-card p-5 lg:col-span-2">
    <div className="mb-5">
      <h2 className="text-base font-bold text-[#33483a]">Bases de datos del parcial</h2>
      <p className="mt-1 text-xs text-[#87938a]">MongoDB conserva usuarios y funciones actuales; PostgreSQL administra clientes/productos y MySQL almacena facturas.</p>
      <p className="mt-2 text-[10px] text-[#78907c]">El catálogo de MongoDB y los clientes registrados se sincronizan aquí automáticamente. Los registros creados directamente en PostgreSQL se pueden editar en esta sección.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        ['MongoDB · usuarios', { connected: true }],
        ['PostgreSQL · clientes y productos', postgres],
        ['MySQL · facturas', mysql],
      ].map(([label, database]) => <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-[#edf0eb] bg-[#fbfcfa] px-4 py-3"><span className="text-xs font-semibold text-[#485a4c]">{label}</span><span className={`badge shrink-0 ${connectionBadge(database)}`}>{connectionLabel(database)}</span></div>)}
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-[#edf0eb] p-4">
        <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-bold text-[#405444]">Productos · PostgreSQL</h3><p className="mt-1 text-[10px] text-[#87938a]">{products.length} registros relacionales</p></div><button disabled={!postgres?.connected} onClick={() => setEditor({ kind: 'products', record: null })} className="btn-secondary px-3 py-2 text-xs disabled:opacity-40"><Plus size={14} /> Añadir</button></div>
        {products.length ? <div className="space-y-2">{products.map((product) => <div key={product.id} className="flex items-center justify-between gap-3 rounded-lg bg-[#f7f9f6] px-3 py-2"><div className="min-w-0"><p className="truncate text-xs font-semibold text-[#435548]">{product.nombre_producto}</p><p className="text-[10px] text-[#87938a]">{money(product.precio)} · Stock {product.stock}{product.mongo_id ? ' · Sincronizado desde MongoDB' : ''}</p></div>{!product.mongo_id && <div className="flex gap-2"><button onClick={() => setEditor({ kind: 'products', record: product })} className="text-[10px] font-bold text-[#4a7952]">Editar</button><button onClick={() => onDelete('products', product.id)} className="text-[10px] font-bold text-[#ad766e]">Eliminar</button></div>}</div>)}</div> : <p className="py-4 text-center text-xs text-[#8a968c]">{postgres?.connected ? 'Aún no hay productos en PostgreSQL.' : 'Configura POSTGRES_* y conecta el servidor para gestionar productos.'}</p>}
      </div>
      <div className="rounded-2xl border border-[#edf0eb] p-4">
        <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-bold text-[#405444]">Clientes · PostgreSQL</h3><p className="mt-1 text-[10px] text-[#87938a]">{customers.length} registros relacionales</p></div><button disabled={!postgres?.connected} onClick={() => setEditor({ kind: 'customers', record: null })} className="btn-secondary px-3 py-2 text-xs disabled:opacity-40"><Plus size={14} /> Añadir</button></div>
        {customers.length ? <div className="space-y-2">{customers.map((customer) => <div key={customer.id} className="flex items-center justify-between gap-3 rounded-lg bg-[#f7f9f6] px-3 py-2"><div className="min-w-0"><p className="truncate text-xs font-semibold text-[#435548]">{customer.nombre}</p><p className="truncate text-[10px] text-[#87938a]">{customer.correo}{customer.mongo_id ? ' · Sincronizado desde MongoDB' : ''}</p></div>{!customer.mongo_id && <div className="flex gap-2"><button onClick={() => setEditor({ kind: 'customers', record: customer })} className="text-[10px] font-bold text-[#4a7952]">Editar</button><button onClick={() => onDelete('customers', customer.id)} className="text-[10px] font-bold text-[#ad766e]">Eliminar</button></div>}</div>)}</div> : <p className="py-4 text-center text-xs text-[#8a968c]">{postgres?.connected ? 'Aún no hay clientes en PostgreSQL.' : 'La conexión PostgreSQL está pendiente.'}</p>}
      </div>
      <div className="rounded-2xl border border-[#edf0eb] p-4 lg:col-span-2">
        <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-bold text-[#405444]">Facturas · MySQL</h3><p className="mt-1 text-[10px] text-[#87938a]">{invoices.length} facturas recientes</p></div></div>
        {invoices.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left"><thead><tr className="border-b border-[#edf0eb] text-[10px] uppercase text-[#909a92]"><th className="pb-2">Factura</th><th className="pb-2">Usuario</th><th className="pb-2">Fecha</th><th className="pb-2 text-right">Total</th><th className="pb-2 text-right">Detalle</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id} className="border-b border-[#f2f4f1] last:border-0"><td className="py-2 text-xs font-semibold text-[#435548]">#{invoice.id}</td><td className="py-2 text-[10px] text-[#78867c]">{invoice.id_usuario}</td><td className="py-2 text-[10px] text-[#78867c]">{shortDate(invoice.fecha)}</td><td className="py-2 text-right text-xs font-bold text-[#3d6946]">{money(invoice.total)}</td><td className="py-2 text-right"><button type="button" onClick={() => setSelectedInvoice(invoice)} className="inline-flex items-center gap-1.5 rounded-full border border-[#dfe8df] bg-white px-3 py-1.5 text-[10px] font-semibold text-[#314238] hover:bg-[#f5f8f4]"><Eye size={13} /> Ver factura</button></td></tr>)}</tbody></table></div> : <p className="py-4 text-center text-xs text-[#8a968c]">{mysql?.connected ? 'Las compras completadas crearán facturas aquí.' : 'Inicia MySQL y configura MYSQL_* en backend/.env para guardar facturas.'}</p>}
      </div>
    </div>
    {selectedInvoice && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1a2e20]/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedInvoice(null) }}>
      <div className="invoice-print max-h-[90vh] w-full max-w-[720px] overflow-y-auto rounded-[24px] bg-white p-6 shadow-2xl">
        <div className="mb-7 flex items-start justify-between border-b border-[#e9eee8] pb-5">
          <div><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#286541]">AgroVet</p><h2 className="serif mt-2 text-3xl text-[#263d2e]">Factura #{selectedInvoice.id}</h2><p className="mt-1 text-sm text-[#7b887e]">Comprobante de compra</p></div>
          <button type="button" onClick={() => setSelectedInvoice(null)} className="invoice-print-close rounded-full p-2 text-[#738076] hover:bg-[#eff3ed]" aria-label="Cerrar factura"><X size={19} /></button>
        </div>
        <div className="mb-7 grid gap-4 text-sm sm:grid-cols-2">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-[#87938a]">Usuario</p><p className="mt-1 break-all font-medium text-[#34493a]">{selectedInvoice.id_usuario}</p></div>
          <div><p className="text-xs font-semibold uppercase tracking-wide text-[#87938a]">Fecha de emisión</p><p className="mt-1 font-medium text-[#34493a]">{shortDate(selectedInvoice.fecha)}</p></div>
          <div><p className="text-xs font-semibold uppercase tracking-wide text-[#87938a]">Estado</p><p className="mt-1 font-medium capitalize text-[#34493a]">{selectedInvoice.estado || 'pagada'}</p></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[440px] text-left">
            <thead><tr className="border-b border-[#e9eee8] text-[10px] uppercase tracking-wide text-[#87938a]"><th className="py-2">Producto</th><th className="py-2 text-right">Cantidad</th><th className="py-2 text-right">Precio unitario</th><th className="py-2 text-right">Subtotal</th></tr></thead>
            <tbody>{(selectedInvoice.items || []).map((item, index) => <tr key={`${item.id_producto}-${index}`} className="border-b border-[#f2f4f1] last:border-0"><td className="py-3 text-sm font-medium text-[#34493a]">{item.nombre_producto}</td><td className="py-3 text-right text-sm text-[#59685d]">{item.cantidad}</td><td className="py-3 text-right text-sm text-[#59685d]">{money(item.precio)}</td><td className="py-3 text-right text-sm font-semibold text-[#34493a]">{money(Number(item.precio) * Number(item.cantidad))}</td></tr>)}</tbody>
          </table>
          {!selectedInvoice.items?.length && <p className="py-6 text-center text-sm text-[#87938a]">Esta factura no tiene productos en su detalle.</p>}
        </div>
        <div className="mt-5 flex justify-end border-t border-[#e9eee8] pt-4"><div className="text-right"><p className="text-xs font-semibold uppercase tracking-wide text-[#87938a]">Total pagado</p><p className="mt-1 text-2xl font-extrabold text-[#286541]">{money(selectedInvoice.total)}</p></div></div>
        <p className="mt-8 border-t border-[#edf0eb] pt-4 text-center text-xs text-[#87938a]">Gracias por elegir AgroVet.</p>
        <div className="invoice-print-actions mt-6 flex flex-wrap justify-end gap-2 border-t border-[#edf0eb] pt-4">
          <button type="button" onClick={() => setSelectedInvoice(null)} className="btn-secondary">Cerrar</button>
          <button type="button" onClick={() => window.print()} className="btn-primary"><Download size={15} /> Descargar PDF</button>
        </div>
        <p className="invoice-print-actions mt-2 text-right text-[10px] text-[#87938a]">En la ventana de impresión, selecciona «Guardar como PDF».</p>
      </div>
    </div>}
    {editor && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1a2e20]/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(null) }}><form onSubmit={submit} className="w-full max-w-[460px] rounded-[24px] bg-[#fbfcfa] p-6 shadow-2xl">
      <div className="mb-5 flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#78907c]">PostgreSQL</p><h3 className="serif mt-1 text-2xl text-[#293f30]">{editor.kind === 'products' ? 'Producto relacional' : 'Cliente relacional'}</h3></div><button type="button" onClick={() => setEditor(null)} className="rounded-full p-2 text-[#87938a]" aria-label="Cerrar"><X size={18} /></button></div>
      {editor.kind === 'products'
        ? <div className="space-y-3"><label><span className="label">Nombre del producto</span><input required name="nombre_producto" defaultValue={editor.record?.nombre_producto || ''} className="input-field" /></label><label><span className="label">Descripción</span><textarea name="descripcion" defaultValue={editor.record?.descripcion || ''} rows="2" className="input-field" /></label><div className="grid grid-cols-2 gap-3"><label><span className="label">Precio (COP)</span><input required type="number" min="0" step="1" name="precio" defaultValue={editor.record?.precio || 0} className="input-field" /></label><label><span className="label">Stock</span><input required type="number" min="0" step="1" name="stock" defaultValue={editor.record?.stock || 0} className="input-field" /></label></div><label><span className="label">Imagen (URL)</span><input name="imagen" defaultValue={editor.record?.imagen || ''} className="input-field" /></label><input type="hidden" name="activo" value={editor.record?.activo === false ? 'false' : 'true'} /></div>
        : <div className="space-y-3"><label><span className="label">Nombre</span><input required name="nombre" defaultValue={editor.record?.nombre || ''} className="input-field" /></label><label><span className="label">Correo</span><input required type="email" name="correo" defaultValue={editor.record?.correo || ''} className="input-field" /></label><label><span className="label">Teléfono</span><input name="telefono" defaultValue={editor.record?.telefono || ''} className="input-field" /></label><label><span className="label">Dirección</span><input name="direccion" defaultValue={editor.record?.direccion || ''} className="input-field" /></label></div>}
      <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setEditor(null)} className="btn-secondary">Cancelar</button><button className="btn-primary">Guardar</button></div>
    </form></div>}
  </section>
}

function CartDrawer({ cart, total, onClose, onQuantity, onClear, onCheckout, busy }) {
  return <div className="cart-backdrop fixed inset-0 z-50 flex justify-end bg-[#1a2e20]/35" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <aside className="cart-panel flex h-full w-full max-w-[430px] flex-col bg-[#fbfcfa] shadow-2xl"><div className="flex items-center justify-between border-b border-[#e9eee8] px-5 py-5"><div><h2 className="text-lg font-bold text-[#304536]">Tu carrito</h2><p className="mt-1 text-xs text-[#89948b]">{cart.reduce((sum, item) => sum + item.cantidad, 0)} productos</p></div><button onClick={onClose} className="rounded-full p-2 text-[#738076] hover:bg-[#eff3ed]" aria-label="Cerrar carrito"><X size={19} /></button></div>
      {cart.length ? <><div className="flex-1 space-y-3 overflow-y-auto p-5">{cart.map((item) => <div key={`${item._id}-${item.cantidad}`} className="cart-item-enter flex gap-3 rounded-2xl border border-[#e9eee8] bg-white p-3"><img src={item.imagen || productPlaceholder} onError={(event) => { event.currentTarget.src = productPlaceholder }} className="h-20 w-20 rounded-xl object-cover" alt="" /><div className="flex min-w-0 flex-1 flex-col justify-between py-1"><div className="flex justify-between gap-2"><p className="line-clamp-2 text-xs font-bold text-[#394d3e]">{item.nombre_producto}</p><button onClick={() => onQuantity(item, -item.cantidad)} aria-label="Eliminar producto"><X size={14} className="text-[#a0aaa2]" /></button></div><div className="flex items-center justify-between"><div className="flex items-center rounded-full border border-[#e7ece5]"><button disabled={item.cantidad <= 1} onClick={() => onQuantity(item, -1)} className="px-2 py-1 text-[#607166] disabled:opacity-40" aria-label="Disminuir cantidad"><Minus size={12} /></button><span className="min-w-5 text-center text-[11px] font-semibold">{item.cantidad}</span><button disabled={item.cantidad >= item.stock} onClick={() => onQuantity(item, 1)} className="px-2 py-1 text-[#607166] disabled:opacity-40" aria-label="Aumentar cantidad"><Plus size={12} /></button></div><span className="text-xs font-bold text-[#375a3c]">{money(item.precio * item.cantidad)}</span></div></div></div>)}</div><div className="border-t border-[#e9eee8] bg-white p-5"><div className="mb-2 flex justify-between text-xs text-[#7e8b81]"><span>Subtotal</span><span>{money(total)}</span></div><div className="mb-4 flex justify-between text-sm font-bold text-[#344a39]"><span>Total</span><span>{money(total)}</span></div><button onClick={onCheckout} disabled={busy} className="btn-primary w-full disabled:opacity-60">{busy ? 'Procesando...' : 'Finalizar compra'} <ArrowRight size={15} /></button><button onClick={onClear} className="mt-3 w-full text-center text-[11px] font-semibold text-[#9a6f68]">Vaciar carrito</button></div></> : <div className="flex flex-1 flex-col items-center justify-center px-8 text-center"><span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eff4ed] text-[#63856a]"><ShoppingBag size={24} /></span><h3 className="text-sm font-bold text-[#3c5141]">Tu carrito está vacío</h3><p className="mt-2 text-xs leading-5 text-[#859187]">Explora el catálogo y encuentra algo especial para tus animales.</p><button onClick={onClose} className="btn-secondary mt-5">Seguir comprando</button></div>}
    </aside>
  </div>
}

function AuthModal({ mode, setMode, onClose, onSubmit, onGoogle, onGoogleError, busy }) {
  const isRegister = mode === 'register'
  const isForgot = mode === 'forgot'
  const isReset = mode === 'reset'
  const title = isRegister ? 'Crea tu cuenta.' : isForgot ? 'Recupera tu acceso.' : isReset ? 'Nueva contraseña.' : 'Bienvenido de vuelta.'
  return <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[#1a2e20]/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="relative my-auto w-full max-w-[440px] rounded-[26px] bg-[#fbfcfa] p-6 shadow-2xl sm:p-8"><button onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 text-[#87938a] hover:bg-[#eff3ed]" aria-label="Cerrar"><X size={18} /></button>
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#286541] text-white"><Sprout size={22} /></span><p className="mb-1 text-[10px] font-bold uppercase tracking-[.16em] text-[#78907c]">{isRegister ? 'Únete a AgroVet' : isForgot || isReset ? 'Recuperación segura' : 'Qué gusto verte'}</p><h2 className="serif text-3xl text-[#293f30]">{title}</h2><p className="mt-2 text-xs text-[#829087]">{isRegister ? 'Tu comunidad de cuidado comienza aquí.' : isForgot ? 'Te enviaremos un enlace de recuperación a tu correo.' : isReset ? 'Elige una contraseña de al menos 8 caracteres.' : 'Ingresa a tu cuenta para continuar.'}</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        {isRegister && <><label><span className="label">Nombre completo</span><input required name="nombre" className="input-field" placeholder="Tu nombre" /></label><div className="grid grid-cols-2 gap-3"><label><span className="label">Nombre de usuario</span><input required name="usuario" minLength="3" className="input-field" placeholder="usuario" /></label><label><span className="label">Teléfono</span><input name="telefono" className="input-field" placeholder="300 000 0000" /></label></div></>}
        {(isRegister || isForgot || (!isReset && !isRegister)) && <label><span className="label">{isRegister || isForgot ? 'Correo electrónico' : 'Usuario o correo'}</span><input required name={isRegister || isForgot ? 'correo' : 'identificador'} type={isRegister || isForgot ? 'email' : 'text'} className="input-field" placeholder={isRegister || isForgot ? 'tu@correo.com' : 'tu usuario o correo'} /></label>}
        {isRegister && <label><span className="label">Dirección</span><input name="direccion" className="input-field" placeholder="Ciudad, departamento" /></label>}
        {!isForgot && <label><span className="label">{isReset ? 'Nueva contraseña' : 'Contraseña'}</span><input required name="password" type="password" minLength={isRegister || isReset ? 8 : undefined} className="input-field" placeholder={isRegister || isReset ? 'Mínimo 8 caracteres' : 'Tu contraseña'} /></label>}
        <button disabled={busy} className="btn-primary mt-2 w-full disabled:opacity-60">{busy ? 'Un momento...' : isRegister ? 'Crear cuenta' : isForgot ? 'Enviar enlace' : isReset ? 'Guardar contraseña' : 'Ingresar'} <ArrowRight size={15} /></button>
      </form>
      {!isRegister && !isForgot && !isReset && <div className="mt-4">
        <div className="relative my-4 text-center text-[10px] text-[#9aa49c] before:absolute before:left-0 before:top-1/2 before:h-px before:w-[43%] before:bg-[#e7ece5] after:absolute after:right-0 after:top-1/2 after:h-px after:w-[43%] after:bg-[#e7ece5]">o continúa con</div>
        {googleClientId
          ? <div className="flex justify-center"><GoogleLogin onSuccess={({ credential }) => { if (credential) onGoogle(credential) }} onError={onGoogleError} /></div>
          : <p className="rounded-xl bg-[#f2f5f0] px-3 py-2 text-center text-[10px] text-[#849087]">Google Sign-In estará disponible al configurar VITE_GOOGLE_CLIENT_ID.</p>}
      </div>}
      {isForgot || isReset
        ? <p className="mt-5 text-center text-xs text-[#829087]"><button onClick={() => setMode('login')} className="font-bold text-[#39734c]">Volver a iniciar sesión</button></p>
        : <div className="mt-5 flex items-center justify-center gap-3 text-xs text-[#829087]">{!isRegister && <button onClick={() => setMode('forgot')} className="font-bold text-[#39734c]">¿Olvidaste tu contraseña?</button>}<span>{isRegister ? '¿Ya tienes una cuenta?' : '¿Aún no tienes cuenta?'}</span><button onClick={() => setMode(isRegister ? 'login' : 'register')} className="font-bold text-[#39734c]">{isRegister ? 'Ingresa aquí' : 'Regístrate'}</button></div>}
    </div>
  </div>
}

function UserModal({ person, onClose, onSave }) {
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1a2e20]/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form onSubmit={onSave} className="w-full max-w-[440px] rounded-[24px] bg-[#fbfcfa] p-6 shadow-2xl">
    <div className="mb-5 flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#78907c]">Gestión de usuarios</p><h2 className="serif mt-1 text-2xl text-[#293f30]">Editar perfil</h2></div><button type="button" onClick={onClose} className="rounded-full p-2 text-[#87938a] hover:bg-[#eff3ed]" aria-label="Cerrar"><X size={18} /></button></div>
    <div className="space-y-3"><label><span className="label">Nombre</span><input required name="nombre" defaultValue={person.nombre} className="input-field" /></label><label><span className="label">Usuario</span><input required minLength="3" name="usuario" defaultValue={person.usuario} className="input-field" /></label><label><span className="label">Correo</span><input required type="email" name="correo" defaultValue={person.correo} className="input-field" /></label><div className="grid grid-cols-2 gap-3"><label><span className="label">Teléfono</span><input name="telefono" defaultValue={person.telefono} className="input-field" /></label><label><span className="label">Dirección</span><input name="direccion" defaultValue={person.direccion} className="input-field" /></label></div><label><span className="label">Nueva contraseña <span className="font-normal text-[#9aa39c]">(opcional)</span></span><input type="password" minLength="8" name="password" className="input-field" /></label></div>
    <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="btn-secondary">Cancelar</button><button className="btn-primary">Guardar cambios</button></div>
  </form></div>
}

function ProductModal({ product, onClose, onSave }) {
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1a2e20]/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form onSubmit={onSave} className="w-full max-w-[500px] rounded-[24px] bg-[#fbfcfa] p-6 shadow-2xl">
    <div className="mb-5 flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#78907c]">Inventario</p><h2 className="serif mt-1 text-2xl text-[#293f30]">{product._id ? 'Editar producto' : 'Nuevo producto'}</h2></div><button type="button" onClick={onClose} className="rounded-full p-2 text-[#87938a] hover:bg-[#eff3ed]"><X size={18} /></button></div>
    <div className="space-y-3"><label><span className="label">Nombre</span><input required name="nombre_producto" defaultValue={product.nombre_producto} className="input-field" /></label><label><span className="label">Descripción</span><textarea name="descripcion" rows="2" defaultValue={product.descripcion} className="input-field resize-y" /></label><div className="grid grid-cols-2 gap-3"><label><span className="label">Precio (COP)</span><input required min="0" step="1" type="number" name="precio" defaultValue={product.precio} className="input-field" /></label><label><span className="label">Stock</span><input required min="0" step="1" type="number" name="stock" defaultValue={product.stock} className="input-field" /></label></div><label><span className="label">URL de imagen</span><input type="url" name="imagen" defaultValue={product.imagen} className="input-field" placeholder="https://..." /></label>{product._id && <label><span className="label">Estado</span><select name="activo" defaultValue={String(product.activo)} className="input-field"><option value="true">Activo</option><option value="false">Inactivo</option></select></label>}</div>
    <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="btn-secondary">Cancelar</button><button className="btn-primary">Guardar producto</button></div>
  </form></div>
}

function Footer({ navigate }) {
  return <footer className="border-t border-[#e7ece5] bg-white"><div className="page-width grid gap-8 py-9 sm:grid-cols-[1.3fr_1fr_1fr]"><div><button onClick={() => navigate('inicio')} className="flex items-center gap-2 text-left"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#286541] text-white"><Sprout size={19} /></span><span className="text-lg font-extrabold tracking-[-.06em] text-[#29402f]">agrovet</span></button><p className="mt-3 max-w-xs text-xs leading-5 text-[#819087]">Cuidado integral para los animales que hacen parte de tu vida.</p></div><div><p className="mb-3 text-xs font-bold text-[#405444]">Descubre</p><div className="space-y-2 text-xs text-[#7e8b81]"><button onClick={() => navigate('nosotros')} className="block">Nosotros</button><button onClick={() => navigate('productos')} className="block">Productos</button><button onClick={() => navigate('contacto')} className="block">Contacto</button></div></div><div><p className="mb-3 text-xs font-bold text-[#405444]">Estamos cerca</p><p className="text-xs leading-5 text-[#7e8b81]">hola@agrovet.co<br />Lunes a sábado · 8 a. m. – 6 p. m.<br />Colombia</p></div></div><div className="border-t border-[#f0f2ef] py-4 text-center text-[10px] text-[#9aa49c]">© {new Date().getFullYear()} AgroVet. Hecho para quienes cuidan.</div></footer>
}

export default App
