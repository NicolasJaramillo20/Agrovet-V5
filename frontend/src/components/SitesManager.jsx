import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, MapPin, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { api } from '../api'
import SiteMapPicker from './SiteMapPicker'

const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
const categories = ['Veterinaria', 'Tienda agropecuaria', 'Farmacia veterinaria', 'Finca o granja', 'Parque o reserva', 'Otro']
const emptySite = () => ({ nombre: '', descripcion: '', categoria: 'Otro', direccion: '', latitud: '', longitud: '' })
const siteDate = (value) => value
  ? new Date(value).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—'
const mapsUrl = (site) => {
  const url = new URL('https://www.google.com/maps/search/')
  url.searchParams.set('api', '1')
  url.searchParams.set('query', `${site.latitud},${site.longitud}`)
  return url.toString()
}

export default function SitesManager({ token, notify }) {
  const [sites, setSites] = useState([])
  const [form, setForm] = useState(emptySite)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadSites = useCallback(async () => {
    setLoading(true)
    try {
      setSites(await api('/sites', { token }))
    } catch (error) {
      notify(error.message)
    } finally {
      setLoading(false)
    }
  }, [notify, token])

  useEffect(() => {
    let active = true
    api('/sites', { token })
      .then((result) => { if (active) setSites(result) })
      .catch((error) => { if (active) notify(error.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [notify, token])

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function updateCoordinates(coordinates) {
    setForm((current) => ({ ...current, ...coordinates }))
  }

  function editSite(site) {
    setEditingId(site.id)
    setForm({
      nombre: site.nombre,
      descripcion: site.descripcion || '',
      categoria: site.categoria,
      direccion: site.direccion || '',
      latitud: String(site.latitud),
      longitud: String(site.longitud),
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptySite())
  }

  async function saveSite(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await api(editingId ? `/sites/${editingId}` : '/sites', {
        method: editingId ? 'PUT' : 'POST',
        token,
        body: JSON.stringify({
          ...form,
          latitud: Number(form.latitud),
          longitud: Number(form.longitud),
        }),
      })
      await loadSites()
      resetForm()
      notify(editingId ? 'Sitio de interés actualizado.' : 'Sitio de interés guardado en Neon.')
    } catch (error) {
      notify(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteSite(site) {
    if (!window.confirm(`¿Eliminar el sitio «${site.nombre}»?`)) return
    try {
      await api(`/sites/${site.id}`, { method: 'DELETE', token })
      setSites((current) => current.filter((item) => item.id !== site.id))
      if (editingId === site.id) resetForm()
      notify('Sitio de interés eliminado.')
    } catch (error) {
      notify(error.message)
    }
  }

  return <section className="panel-card p-5 lg:col-span-2">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#78907c]"><MapPin size={13} /> Google Maps · Neon</p>
        <h2 className="text-base font-bold text-[#33483a]">Mis sitios de interés</h2>
        <p className="mt-1 text-xs text-[#87938a]">Guarda veterinarias, tiendas, fincas y otros puntos con su ubicación geográfica.</p>
      </div>
      <span className="badge bg-[#edf5ea] text-[#4c8053]">Datos en PostgreSQL · Neon</span>
    </div>

    <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
      <form onSubmit={saveSite} className="space-y-3 rounded-2xl bg-[#f7f9f6] p-4">
        <label><span className="label">Nombre del sitio</span><input required maxLength="120" name="nombre" value={form.nombre} onChange={updateField} className="input-field" placeholder="Ej. Clínica veterinaria" /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className="label">Categoría</span><select name="categoria" value={form.categoria} onChange={updateField} className="input-field">{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label><span className="label">Dirección o referencia</span><input maxLength="240" name="direccion" value={form.direccion} onChange={updateField} className="input-field" placeholder="Opcional" /></label>
        </div>
        <label><span className="label">Descripción</span><textarea maxLength="1000" name="descripcion" value={form.descripcion} onChange={updateField} rows="2" className="input-field resize-y" placeholder="Información útil sobre este lugar" /></label>
        <SiteMapPicker apiKey={mapsApiKey} latitude={form.latitud} longitude={form.longitud} onChange={updateCoordinates} />
        <div className="grid grid-cols-2 gap-3">
          <label><span className="label">Latitud</span><input required type="number" min="-90" max="90" step="any" name="latitud" value={form.latitud} onChange={updateField} className="input-field" placeholder="4.7110" /></label>
          <label><span className="label">Longitud</span><input required type="number" min="-180" max="180" step="any" name="longitud" value={form.longitud} onChange={updateField} className="input-field" placeholder="-74.0721" /></label>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button disabled={saving} className="btn-primary disabled:opacity-50">{editingId ? <Save size={15} /> : <Plus size={15} />}{saving ? 'Guardando…' : editingId ? 'Actualizar sitio' : 'Registrar sitio'}</button>
          {editingId && <button type="button" onClick={resetForm} className="btn-secondary"><X size={15} /> Cancelar edición</button>}
        </div>
      </form>

      <div className="min-w-0">
        <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-bold text-[#405444]">Sitios registrados</h3><p className="mt-1 text-[10px] text-[#87938a]">{sites.length} puntos guardados en la base distribuida</p></div></div>
        {loading
          ? <p className="rounded-xl bg-[#f7f9f6] px-4 py-8 text-center text-xs text-[#87938a]">Cargando tus sitios…</p>
          : sites.length
            ? <div className="max-h-[540px] space-y-2 overflow-y-auto pr-1">{sites.map((site) => <article key={site.id} className="rounded-xl border border-[#edf0eb] bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><span className="badge bg-[#edf4eb] text-[#49734e]">{site.categoria}</span><h4 className="mt-2 truncate text-sm font-bold text-[#3b4e40]">{site.nombre}</h4>{site.direccion && <p className="mt-1 truncate text-[11px] text-[#78867c]">{site.direccion}</p>}{site.descripcion && <p className="mt-2 text-xs leading-5 text-[#78867c]">{site.descripcion}</p>}</div>
                <div className="flex shrink-0 gap-1"><button type="button" onClick={() => editSite(site)} className="rounded-lg p-2 text-[#4a7952] hover:bg-[#f1f5ef]" aria-label={`Editar ${site.nombre}`}><Pencil size={14} /></button><button type="button" onClick={() => deleteSite(site)} className="rounded-lg p-2 text-[#ad766e] hover:bg-[#fcf1ef]" aria-label={`Eliminar ${site.nombre}`}><Trash2 size={14} /></button></div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#f0f2ef] pt-2"><p className="text-[10px] text-[#87938a]">{Number(site.latitud).toFixed(6)}, {Number(site.longitud).toFixed(6)} · {siteDate(site.fecha_registro)}</p><a href={mapsUrl(site)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-[#477852]">Abrir en Maps <ExternalLink size={11} /></a></div>
            </article>)}</div>
            : <div className="rounded-xl bg-[#f7f9f6] px-4 py-10 text-center"><MapPin size={22} className="mx-auto mb-2 text-[#91a895]" /><p className="text-xs font-semibold text-[#4e6153]">Aún no has guardado sitios.</p><p className="mt-1 text-[10px] text-[#8b978d]">Selecciona un punto en el mapa o ingresa sus coordenadas.</p></div>}
      </div>
    </div>
  </section>
}
