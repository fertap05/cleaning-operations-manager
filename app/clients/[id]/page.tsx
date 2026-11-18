"use client";
import Link from "next/link";
import {useParams} from "next/navigation";
import {FormEvent,useCallback,useEffect,useState} from "react";
import {supabase} from "@/lib/supabase";
import {message} from "@/lib/data";
import {fullName,money} from "@/lib/types";
import type {Client,Property} from "@/lib/types";
type PropertyForm = {
  property_name:string;address_line1:string;address_line2:string;city:string;state:string;zip_code:string;
  property_type:string;access_type:string;usual_price:string;estimated_duration_minutes:string;
  frequency_type:string;usual_start_time:string;employee_notes:string;private_notes:string;is_active:boolean;
};
const blank:PropertyForm={
  property_name:"",address_line1:"",address_line2:"",city:"",state:"",zip_code:"",
  property_type:"residential",access_type:"client_opens",usual_price:"",estimated_duration_minutes:"",
  frequency_type:"as_needed",usual_start_time:"",employee_notes:"",private_notes:"",is_active:true
};
export default function ClientDetail(){
  const params=useParams<{id:string}>();const id=params.id;
  const [client,setClient]=useState<Client|null>(null);
  const [properties,setProperties]=useState<Property[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [editing,setEditing]=useState<string|null>(null);
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [form,setForm]=useState<PropertyForm>(blank);
  const refresh=useCallback(async()=>{
    try{
      const [a,b]=await Promise.all([
        supabase.from("clients").select("*").eq("id",id).single(),
        supabase.from("properties").select("*").eq("client_id",id).order("property_name")
      ]);
      if(a.error)throw a.error;if(b.error)throw b.error;
      setClient(a.data as Client);setProperties((b.data||[]) as Property[]);setError("");
    }catch(e){setError(message(e));}finally{setLoading(false);}
  },[id]);
  useEffect(()=>{void refresh();},[refresh]);
  function start(p?:Property){
    setEditing(p?.id||null);
    setForm(p?{
      property_name:p.property_name,address_line1:p.address_line1,address_line2:p.address_line2||"",
      city:p.city||"",state:p.state||"",zip_code:p.zip_code||"",
      property_type:p.property_type||"residential",access_type:p.access_type||"client_opens",
      usual_price:p.usual_price===null?"":String(p.usual_price),
      estimated_duration_minutes:p.estimated_duration_minutes===null?"":String(p.estimated_duration_minutes),
      frequency_type:p.frequency_type||"as_needed",usual_start_time:p.usual_start_time?.slice(0,5)||"",
      employee_notes:p.employee_notes||"",private_notes:p.private_notes||"",is_active:p.is_active
    }:blank);setOpen(true);setError("");
  }
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");
    const payload={
      client_id:id, property_name:form.property_name.trim(),address_line1:form.address_line1.trim(),
      address_line2:form.address_line2||null,city:form.city||null,state:form.state||null,zip_code:form.zip_code||null,
      property_type:form.property_type,access_type:form.access_type,
      usual_price:form.usual_price===""?null:Number(form.usual_price),
      estimated_duration_minutes:form.estimated_duration_minutes===""?null:Number(form.estimated_duration_minutes),
      frequency_type:form.frequency_type,usual_start_time:form.usual_start_time||null,
      employee_notes:form.employee_notes||null,private_notes:form.private_notes||null,is_active:form.is_active
    };
    const result=editing?await supabase.from("properties").update(payload).eq("id",editing):
      await supabase.from("properties").insert(payload);
    setBusy(false);
    if(result.error){setError(result.error.message);return;}
    setOpen(false);await refresh();
  }
  if(loading)return <p className="hint">Cargando perfil…</p>;
  return <div className="mx-auto max-w-6xl space-y-6">
    <Link href="/clients" className="text-sm text-slate-600 hover:underline">← Volver a clientes</Link>
    {client&&<div className="panel"><h1 className="page-title">{fullName(client)}</h1>
      <p className="hint">{client.phone||"Sin teléfono"} · {client.email||"Sin email"}</p>
      {client.general_notes&&<p className="mt-3 text-sm"><strong>Nota interna:</strong> {client.general_notes}</p>}
    </div>}
    <header className="flex flex-wrap justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Propiedades</h2><p className="hint">Cada casa u oficina tiene sus propias instrucciones.</p></div>
      <button className="btn-primary" onClick={()=>start()}>+ Nueva propiedad</button>
    </header>
    {error&&!open&&<p role="alert" className="text-red-700">{error}</p>}
    <div className="grid gap-4 md:grid-cols-2">
      {properties.map(p=><article className="panel space-y-3" key={p.id}>
        <div className="flex justify-between gap-2">
          <div><h3 className="font-semibold text-lg">{p.property_name}</h3>
            <p className="hint">{p.address_line1}{p.city?", "+p.city:""}{p.state?", "+p.state:""}</p>
          </div><button className="btn-outline text-sm" onClick={()=>start(p)}>Editar</button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p><strong>Precio:</strong> {money(p.usual_price)}</p>
          <p><strong>Duración:</strong> {p.estimated_duration_minutes||"—"} min</p>
          <p><strong>Frecuencia:</strong> {p.frequency_type||"—"}</p>
          <p><strong>Acceso:</strong> {p.access_type||"—"}</p>
        </div>
        {p.employee_notes&&<p className="rounded-lg bg-blue-50 p-3 text-sm"><strong>Para trabajadores:</strong> {p.employee_notes}</p>}
        {p.private_notes&&<p className="rounded-lg bg-amber-50 p-3 text-sm"><strong>Solo dueños:</strong> {p.private_notes}</p>}
      </article>)}
      {!properties.length&&<p className="hint">Todavía no hay propiedades registradas.</p>}
    </div>
    {open&&<section className="panel">
      <h3 className="mb-4 text-xl font-semibold">{editing?"Editar propiedad":"Nueva propiedad"}</h3>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label>Nombre de la propiedad *<input className="field mt-1" required value={form.property_name} onChange={e=>setForm({...form,property_name:e.target.value})}/></label>
        <label>Dirección *<input className="field mt-1" required value={form.address_line1} onChange={e=>setForm({...form,address_line1:e.target.value})}/></label>
        <label>Detalles de dirección<input className="field mt-1" value={form.address_line2} onChange={e=>setForm({...form,address_line2:e.target.value})}/></label>
        <label>Ciudad<input className="field mt-1" value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></label>
        <label>Estado<input className="field mt-1" value={form.state} onChange={e=>setForm({...form,state:e.target.value})}/></label>
        <label>ZIP<input className="field mt-1" value={form.zip_code} onChange={e=>setForm({...form,zip_code:e.target.value})}/></label>
        <label>Tipo de propiedad<select className="field mt-1" value={form.property_type} onChange={e=>setForm({...form,property_type:e.target.value})}>
          <option value="residential">Casa</option><option value="office">Oficina</option>
          <option value="church">Iglesia</option><option value="rental">Alquiler/Airbnb</option><option value="other">Otro</option>
        </select></label>
        <label>Forma de entrada<select className="field mt-1" value={form.access_type} onChange={e=>setForm({...form,access_type:e.target.value})}>
          <option value="client_opens">Cliente abre</option><option value="key">Tenemos llave</option>
          <option value="code">Código (no guardar aún)</option><option value="other">Otro</option>
        </select></label>
        <label>Precio habitual ($)<input className="field mt-1" type="number" min="0" step="0.01" value={form.usual_price} onChange={e=>setForm({...form,usual_price:e.target.value})}/></label>
        <label>Duración estimada (minutos)<input className="field mt-1" type="number" min="0" value={form.estimated_duration_minutes} onChange={e=>setForm({...form,estimated_duration_minutes:e.target.value})}/></label>
        <label>Frecuencia habitual<select className="field mt-1" value={form.frequency_type} onChange={e=>setForm({...form,frequency_type:e.target.value})}>
          <option value="as_needed">Cuando se necesita</option><option value="weekly">Semanal</option>
          <option value="biweekly">Cada 2 semanas</option><option value="monthly">Mensual</option>
        </select></label>
        <label>Hora habitual<input className="field mt-1" type="time" value={form.usual_start_time} onChange={e=>setForm({...form,usual_start_time:e.target.value})}/></label>
        <label className="sm:col-span-2">Notas visibles para empleados<textarea rows={3} className="field mt-1" value={form.employee_notes} onChange={e=>setForm({...form,employee_notes:e.target.value})}/></label>
        <label className="sm:col-span-2">Notas privadas (solo dueños)<textarea rows={3} className="field mt-1" value={form.private_notes} onChange={e=>setForm({...form,private_notes:e.target.value})}/></label>
        <p className="hint sm:col-span-2">No introduzcas códigos de puertas, alarmas ni llaves digitales todavía.</p>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/>Propiedad activa</label>
        {error&&<p role="alert" className="text-red-700 sm:col-span-2">{error}</p>}
        <div className="flex gap-2 sm:col-span-2"><button className="btn-primary" type="submit" disabled={busy}>{busy?"Guardando…":"Guardar propiedad"}</button>
          <button type="button" className="btn-outline" onClick={()=>setOpen(false)}>Cancelar</button></div>
      </form>
    </section>}
  </div>;
}
