"use client";
import Link from "next/link";
import {FormEvent,useCallback,useEffect,useState} from "react";
import {supabase} from "@/lib/supabase";
import {getClients,message} from "@/lib/data";
import {fullName} from "@/lib/types";
import type {Client} from "@/lib/types";

type ClientForm={first_name:string;last_name:string;phone:string;secondary_phone:string;email:string;preferred_contact_method:string;general_notes:string;is_active:boolean};
const blank:ClientForm={first_name:"",last_name:"",phone:"",secondary_phone:"",email:"",preferred_contact_method:"phone",general_notes:"",is_active:true};
export default function ClientsPage(){
  const [clients,setClients]=useState<Client[]>([]);
  const [query,setQuery]=useState("");
  const [open,setOpen]=useState(false);
  const [editing,setEditing]=useState<string|null>(null);
  const [form,setForm]=useState<ClientForm>(blank);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const refresh=useCallback(async()=>{
    try {setClients(await getClients());setError("");}
    catch(e){setError(message(e));} finally {setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  function start(row?:Client){
    setEditing(row?.id||null);
    setForm(row?{
      first_name:row.first_name,last_name:row.last_name||"",phone:row.phone||"",
      secondary_phone:row.secondary_phone||"",email:row.email||"",
      preferred_contact_method:row.preferred_contact_method||"phone",
      general_notes:row.general_notes||"",is_active:row.is_active
    }:blank);
    setError("");setOpen(true);
  }
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");
    const payload={...form,first_name:form.first_name.trim(),
      last_name:form.last_name.trim()||null,phone:form.phone.trim()||null,
      secondary_phone:form.secondary_phone.trim()||null,email:form.email.trim()||null,
      general_notes:form.general_notes.trim()||null};
    const result=editing
      ? await supabase.from("clients").update(payload).eq("id",editing)
      : await supabase.from("clients").insert(payload);
    setBusy(false);
    if(result.error){setError(result.error.message);return;}
    setOpen(false);await refresh();
  }
  const filtered=clients.filter(c=>(fullName(c)+" "+(c.phone||"")+" "+(c.email||"")).toLocaleLowerCase()
    .includes(query.toLocaleLowerCase()));
  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="page-title">Clientes</h1><p className="hint">Contactos, historial y propiedades del negocio.</p></div>
      <button className="btn-primary" onClick={()=>start()}>+ Nuevo cliente</button>
    </header>
    <section className="panel">
      <label className="mb-2 block text-sm font-medium" htmlFor="client-search">Buscar por nombre, teléfono o email</label>
      <input id="client-search" className="field" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ej. Martínez"/>
    </section>
    {error&&!open&&<p role="alert" className="text-red-700">{error}</p>}
    {loading?<p className="hint">Cargando clientes…</p>:
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(c=><article className="panel space-y-3" key={c.id}>
          <div><h2 className="font-semibold text-lg">{fullName(c)}</h2>
            <p className="hint">{c.phone||"Sin teléfono"}</p>
            <p className="hint">{c.email||""}</p>
          </div>
          {!c.is_active&&<span className="text-xs text-amber-700">Inactivo</span>}
          <div className="flex gap-2">
            <Link className="btn-outline text-sm" href={"/clients/"+c.id}>Ver propiedades</Link>
            <button className="btn-outline text-sm" onClick={()=>start(c)}>Editar</button>
          </div>
        </article>)}
        {!filtered.length&&<p className="hint">No se encontraron clientes.</p>}
      </div>}
    {open&&<div className="panel max-w-3xl">
      <h2 className="mb-4 text-xl font-semibold">{editing?"Editar cliente":"Nuevo cliente"}</h2>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label>Nombre *<input required className="field mt-1" value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})}/></label>
        <label>Apellido<input className="field mt-1" value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})}/></label>
        <label>Teléfono<input className="field mt-1" type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
        <label>Segundo teléfono<input className="field mt-1" type="tel" value={form.secondary_phone} onChange={e=>setForm({...form,secondary_phone:e.target.value})}/></label>
        <label>Email<input className="field mt-1" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
        <label>Contacto preferido<select className="field mt-1" value={form.preferred_contact_method} onChange={e=>setForm({...form,preferred_contact_method:e.target.value})}>
          <option value="phone">Teléfono</option><option value="text">Mensaje</option><option value="email">Email</option>
        </select></label>
        <label className="sm:col-span-2">Notas internas<textarea rows={3} className="field mt-1" value={form.general_notes} onChange={e=>setForm({...form,general_notes:e.target.value})}/></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Cliente activo</label>
        {error&&<p role="alert" className="text-red-700 sm:col-span-2">{error}</p>}
        <div className="flex gap-2 sm:col-span-2"><button disabled={busy} className="btn-primary" type="submit">{busy?"Guardando…":"Guardar cliente"}</button>
          <button type="button" className="btn-outline" onClick={()=>setOpen(false)}>Cancelar</button></div>
      </form>
    </div>}
  </div>;
}
