"use client";
import {FormEvent,useCallback,useEffect,useState} from "react";
import {supabase} from "@/lib/supabase";
import {getEmployees,message} from "@/lib/data";
import {fullName,money} from "@/lib/types";
import type {Employee} from "@/lib/types";
type Form={first_name:string;last_name:string;phone:string;is_owner:boolean;is_active:boolean;default_hourly_rate:string;general_notes:string};
const blank:Form={first_name:"",last_name:"",phone:"",is_owner:false,is_active:true,default_hourly_rate:"",general_notes:""};
export default function EmployeesPage(){
  const [employees,setEmployees]=useState<Employee[]>([]);
  const [form,setForm]=useState<Form>(blank);
  const [editing,setEditing]=useState<string|null>(null);
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const refresh=useCallback(async()=>{try{setEmployees(await getEmployees());setError("");}catch(e){setError(message(e));}},[]);
  useEffect(()=>{void refresh();},[refresh]);
  function start(e?:Employee){
    setEditing(e?.id||null);
    setForm(e?{first_name:e.first_name,last_name:e.last_name||"",phone:e.phone||"",is_owner:e.is_owner,
      is_active:e.is_active,default_hourly_rate:e.default_hourly_rate===null?"":String(e.default_hourly_rate),
      general_notes:e.general_notes||""}:blank);
    setOpen(true);setError("");
  }
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");
    const payload={first_name:form.first_name.trim(),last_name:form.last_name||null,
      phone:form.phone||null,is_owner:form.is_owner,role:form.is_owner?"owner":"employee",
      is_active:form.is_active,default_hourly_rate:form.default_hourly_rate===""?null:Number(form.default_hourly_rate),
      general_notes:form.general_notes||null};
    const result=editing?await supabase.from("employees").update(payload).eq("id",editing):
      await supabase.from("employees").insert(payload);
    setBusy(false);if(result.error){setError(result.error.message);return;}
    setOpen(false);await refresh();
  }
  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap justify-between gap-3"><div><h1 className="page-title">Empleados</h1>
      <p className="hint">Equipo flexible: los dueños también pueden trabajar en limpiezas.</p></div>
      <button className="btn-primary" onClick={()=>start()}>+ Nuevo empleado</button></header>
    {error&&!open&&<p role="alert" className="text-red-700">{error}</p>}
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {employees.map(e=><article className="panel space-y-3" key={e.id}>
        <div className="flex justify-between"><h2 className="font-semibold text-lg">{fullName(e)}</h2>
          <span className="text-xs text-slate-500">{e.is_owner?"Dueño":"Empleado"}</span></div>
        <p className="hint">{e.phone||"Sin teléfono"}</p>
        <p className="text-sm">Tarifa: {money(e.default_hourly_rate)}/hora</p>
        <p className="text-xs text-slate-500">{e.is_active?"Activo":"Inactivo"}</p>
        <button className="btn-outline text-sm" onClick={()=>start(e)}>Editar</button>
      </article>)}
    </div>
    {open&&<section className="panel max-w-3xl"><h2 className="mb-4 text-xl font-semibold">{editing?"Editar empleado":"Nuevo empleado"}</h2>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label>Nombre *<input required className="field mt-1" value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})}/></label>
        <label>Apellido<input className="field mt-1" value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})}/></label>
        <label>Teléfono<input className="field mt-1" type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
        <label>Tarifa por hora ($)<input className="field mt-1" type="number" min="0" step="0.01" value={form.default_hourly_rate} onChange={e=>setForm({...form,default_hourly_rate:e.target.value})}/></label>
        <label className="sm:col-span-2">Notas privadas<textarea className="field mt-1" value={form.general_notes} onChange={e=>setForm({...form,general_notes:e.target.value})}/></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_owner} onChange={e=>setForm({...form,is_owner:e.target.checked})}/> Dueño / asignable a trabajos</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Activo</label>
        {error&&<p role="alert" className="text-red-700 sm:col-span-2">{error}</p>}
        <div className="flex gap-2 sm:col-span-2"><button disabled={busy} className="btn-primary">{busy?"Guardando…":"Guardar empleado"}</button>
          <button type="button" onClick={()=>setOpen(false)} className="btn-outline">Cancelar</button></div>
      </form>
    </section>}
  </div>;
}
