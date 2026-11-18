"use client";
import Link from "next/link";
import {FormEvent,useCallback,useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import {getEmployees,getJobs,getProperties,message} from "@/lib/data";
import {displayDate,fullName,localDate,statuses,timeLabel} from "@/lib/types";
import type {Employee,Job,Property} from "@/lib/types";

type JobForm = {
  property_id:string;job_date:string;start_time:string;end_time:string;status:string;price:string;
  employee_notes:string;private_notes:string;cancellation_reason:string;is_extra_job:boolean;employee_ids:string[];
};
const empty=():JobForm=>({property_id:"",job_date:localDate(),start_time:"09:00",end_time:"12:00",
  status:"pending_confirmation",price:"",employee_notes:"",private_notes:"",
  cancellation_reason:"",is_extra_job:false,employee_ids:[]});
export default function JobsPage(){
  const [jobs,setJobs]=useState<Job[]>([]);
  const [properties,setProperties]=useState<Property[]>([]);
  const [employees,setEmployees]=useState<Employee[]>([]);
  const [open,setOpen]=useState(false);
  const [editing,setEditing]=useState<string|null>(null);
  const [form,setForm]=useState<JobForm>(empty);
  const [query,setQuery]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const refresh=useCallback(async()=>{
    try{
      const [j,p,e]=await Promise.all([getJobs(),getProperties(),getEmployees()]);
      setJobs(j);setProperties(p);setEmployees(e);setError("");
    }catch(e){setError(message(e));}finally{setLoading(false);}
  },[]);
  useEffect(()=>{void Promise.resolve().then(refresh);},[refresh]);
  useEffect(()=>{
    void Promise.resolve().then(()=>{
      if(typeof window==="undefined"||!jobs.length)return;
      const target=new URLSearchParams(window.location.search).get("edit");
      const found=jobs.find(j=>j.id===target);
      if(found){startEdit(found);window.history.replaceState({},"","/jobs");}
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[jobs]);
  const propertyMap=useMemo(()=>new Map(properties.map(p=>[p.id,p])),[properties]);
  function startNew(){
    setForm(empty());setEditing(null);setOpen(true);setError("");setNotice("");
  }
  function startEdit(job:Job,duplicate=false){
    setEditing(duplicate?null:job.id);
    setForm({
      property_id:job.property_id,job_date:duplicate?localDate():job.job_date,
      start_time:job.start_time?.slice(0,5)||"",
      end_time:job.estimated_end_time?.slice(0,5)||"",
      status:duplicate?"pending_confirmation":job.status,
      price:job.price===null?"":String(job.price),
      employee_notes:job.employee_notes||"",private_notes:job.private_notes||"",
      cancellation_reason:duplicate?"":job.cancellation_reason||"",
      is_extra_job:job.is_extra_job,
      employee_ids:(job.job_assignments||[]).map(a=>a.employee_id)
    });
    setOpen(true);setError("");setNotice("");
  }
  function changeProperty(id:string){
    const p=propertyMap.get(id);
    setForm(prev=>({...prev,property_id:id,
      price:p?.usual_price===null||p?.usual_price===undefined?"":String(p.usual_price),
      start_time:p?.usual_start_time?.slice(0,5)||prev.start_time,
      end_time:p?.estimated_duration_minutes && p.usual_start_time
        ? (()=>{const [h,m]=p.usual_start_time.slice(0,5).split(":").map(Number);
          const minutes=h*60+m+p.estimated_duration_minutes;
          return String(Math.floor(minutes/60)).padStart(2,"0")+":"+String(minutes%60).padStart(2,"0");})()
        : prev.end_time
    }));
  }
  const clashes=useMemo(()=>{
    if(!form.job_date||!form.start_time||!form.end_time)return [];
    return jobs.filter(j=>j.id!==editing&&j.status!=="cancelled"&&j.job_date===form.job_date &&
      j.start_time&&j.estimated_end_time &&
      form.start_time < j.estimated_end_time.slice(0,5) &&
      form.end_time > j.start_time.slice(0,5))
      .flatMap(j=>(j.job_assignments||[])
        .filter(a=>form.employee_ids.includes(a.employee_id))
        .map(a=>(a.employees?.first_name||"Empleado")+" ya tiene "+(j.properties?.property_name||"otro trabajo")));
  },[form.job_date,form.start_time,form.end_time,form.employee_ids,jobs,editing]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError("");setNotice("");
    if(!form.property_id)return setError("Selecciona una propiedad.");
    if(form.start_time&&form.end_time&&form.end_time<=form.start_time)
      return setError("La hora de terminar debe ser posterior a la de inicio.");
    setBusy(true);
    const {error:writeError}=await supabase.rpc("save_job",{
      p_property_id:form.property_id,
      p_job_date:form.job_date,
      p_start_time:form.start_time||null,
      p_end_time:form.end_time||null,
      p_status:form.status,
      p_price:form.price===""?null:Number(form.price),
      p_employee_ids:form.employee_ids,
      p_job_id:editing,
      p_employee_notes:form.employee_notes||null,
      p_private_notes:form.private_notes||null,
      p_is_extra_job:form.is_extra_job,
      p_cancellation_reason:form.status==="cancelled"?(form.cancellation_reason||null):null
    });
    setBusy(false);
    if(writeError){setError(writeError.message);return;}
    setOpen(false);setNotice("Trabajo guardado correctamente.");await refresh();
  }
  const filtered=jobs.filter(j=>{
    const txt=(j.properties?.property_name||"")+" "+(j.properties?.clients?fullName(j.properties.clients):"")+" "+j.job_date;
    return txt.toLocaleLowerCase().includes(query.toLocaleLowerCase());
  }).sort((a,b)=>b.job_date.localeCompare(a.job_date)||String(a.start_time).localeCompare(String(b.start_time)));
  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="page-title">Trabajos</h1><p className="hint">Programa, asigna equipos y reorganiza cualquier limpieza.</p></div>
      <button onClick={startNew} className="btn-primary">+ Nuevo trabajo</button>
    </header>
    <div className="flex flex-wrap gap-3">
      <Link className="btn-outline" href="/calendar">Ver calendario semanal</Link>
      <input className="field max-w-md" aria-label="Buscar trabajos" placeholder="Buscar cliente, propiedad o fecha" value={query} onChange={e=>setQuery(e.target.value)}/>
    </div>
    {notice&&<p role="status" className="text-emerald-700">{notice}</p>}
    {error&&!open&&<p role="alert" className="text-red-700">{error}</p>}
    {open&&<section className="panel space-y-4">
      <div className="flex justify-between"><h2 className="text-xl font-semibold">{editing?"Editar trabajo":"Programar limpieza"}</h2>
        <button className="btn-outline text-sm" onClick={()=>setOpen(false)}>Cerrar</button></div>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">Propiedad *<select required className="field mt-1" value={form.property_id} onChange={e=>changeProperty(e.target.value)}>
          <option value="">Selecciona un lugar…</option>
          {properties.filter(p=>p.is_active||p.id===form.property_id).map(p=><option key={p.id} value={p.id}>{p.property_name}{p.clients?" — "+fullName(p.clients):""}</option>)}
        </select></label>
        <label>Fecha *<input required type="date" className="field mt-1" value={form.job_date} onChange={e=>setForm({...form,job_date:e.target.value})}/></label>
        <label>Estado<select className="field mt-1" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
          {Object.entries(statuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>Hora de inicio<input type="time" className="field mt-1" value={form.start_time} onChange={e=>setForm({...form,start_time:e.target.value})}/></label>
        <label>Hora estimada de fin<input type="time" className="field mt-1" value={form.end_time} onChange={e=>setForm({...form,end_time:e.target.value})}/></label>
        <label>Precio acordado ($)<input min="0" step="0.01" type="number" className="field mt-1" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_extra_job} onChange={e=>setForm({...form,is_extra_job:e.target.checked})}/> Limpieza extra / evento</label>
        <fieldset className="sm:col-span-2 rounded-xl border border-slate-200 p-4">
          <legend className="px-1 font-semibold">Empleados asignados (combinación flexible)</legend>
          <div className="flex flex-wrap gap-4">
            {employees.filter(e=>e.is_active||form.employee_ids.includes(e.id)).map(e=><label className="flex items-center gap-2 text-sm" key={e.id}>
              <input type="checkbox" checked={form.employee_ids.includes(e.id)}
                onChange={event=>setForm({...form,employee_ids:event.target.checked
                  ? [...form.employee_ids,e.id] : form.employee_ids.filter(x=>x!==e.id)})}/>
              {fullName(e)}{e.is_owner?" (dueño)":""}
            </label>)}
          </div>
        </fieldset>
        {clashes.length>0&&<div role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900 sm:col-span-2">
          <strong>Posibles conflictos:</strong><ul className="mt-2 list-disc pl-5">{[...new Set(clashes)].map((c,i)=><li key={i}>{c}</li>)}</ul>
          <p className="mt-2">Puedes guardar de todos modos si sabes que los horarios cambiarán.</p>
        </div>}
        <label className="sm:col-span-2">Instrucciones de este trabajo para empleados<textarea rows={2} className="field mt-1" value={form.employee_notes} onChange={e=>setForm({...form,employee_notes:e.target.value})}/></label>
        <label className="sm:col-span-2">Nota privada para dueños<textarea rows={2} className="field mt-1" value={form.private_notes} onChange={e=>setForm({...form,private_notes:e.target.value})}/></label>
        {form.status==="cancelled"&&<label className="sm:col-span-2">Motivo de cancelación<textarea rows={2} className="field mt-1" value={form.cancellation_reason} onChange={e=>setForm({...form,cancellation_reason:e.target.value})}/></label>}
        {error&&<p role="alert" className="text-red-700 sm:col-span-2">{error}</p>}
        <div className="flex gap-2 sm:col-span-2"><button className="btn-primary" type="submit" disabled={busy}>{busy?"Guardando…":"Guardar trabajo"}</button>
          <button type="button" className="btn-outline" onClick={()=>setOpen(false)}>Cancelar</button></div>
      </form>
    </section>}
    {loading?<p className="hint">Cargando trabajos…</p>:
      <div className="space-y-3">
        {filtered.map(j=><article key={j.id} className="panel flex flex-wrap items-center justify-between gap-4">
          <div><h2 className="font-semibold">{j.properties?.property_name||"Propiedad"}</h2>
            <p className="hint">{displayDate(j.job_date)} · {timeLabel(j.start_time)}–{timeLabel(j.estimated_end_time)}</p>
            <p className="text-sm">Equipo: {j.job_assignments?.map(a=>a.employees?.first_name).filter(Boolean).join(", ")||"Sin asignar"}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{statuses[j.status]||j.status}</span>
            <button className="btn-outline text-sm" onClick={()=>startEdit(j)}>Editar</button>
            <button className="btn-outline text-sm" onClick={()=>startEdit(j,true)}>Duplicar</button>
          </div>
        </article>)}
        {!filtered.length&&<p className="hint">No hay trabajos con estos filtros.</p>}
      </div>}
  </div>;
}
