"use client";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useState} from "react";
import {getJobs,message} from "@/lib/data";
import {addDays,displayDate,localDate,monday,statuses,timeLabel} from "@/lib/types";
import type {Job} from "@/lib/types";
export default function CalendarPage(){
  const [week,setWeek]=useState(()=>monday(new Date()));
  const [jobs,setJobs]=useState<Job[]>([]);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const refresh=useCallback(async()=>{try{setJobs(await getJobs());setError("");}
    catch(e){setError(message(e));}finally{setLoading(false);}},[]);
  useEffect(()=>{void refresh();},[refresh]);
  const days=useMemo(()=>Array.from({length:7},(_,i)=>addDays(week,i)),[week]);
  const start=localDate(week),end=localDate(days[6]);
  const visible=jobs.filter(j=>j.job_date>=start&&j.job_date<=end);
  const today=localDate();
  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="page-title">Calendario semanal</h1>
        <p className="hint">Revisa los equipos y organiza cambios sin tachar papeles.</p></div>
      <Link className="btn-primary" href="/jobs">+ Nuevo trabajo</Link>
    </header>
    <div className="panel flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold">{displayDate(start)} — {displayDate(end)}</h2>
        <p className="hint">{visible.length} trabajos esta semana</p></div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-outline" onClick={()=>setWeek(addDays(week,-7))}>← Anterior</button>
        <button className="btn-outline" onClick={()=>setWeek(monday(new Date()))}>Esta semana</button>
        <button className="btn-outline" onClick={()=>setWeek(addDays(week,7))}>Siguiente →</button>
      </div>
    </div>
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    {loading?<p className="hint">Cargando calendario…</p>:
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1080px] grid-cols-7 gap-2">
          {days.map(d=>{
            const key=localDate(d),todayClass=key===today?"border-slate-900":"border-slate-200";
            const dayJobs=visible.filter(j=>j.job_date===key).sort((a,b)=>String(a.start_time).localeCompare(String(b.start_time)));
            return <section key={key} className={"min-h-[420px] rounded-xl border bg-white p-3 "+todayClass}>
              <div className="mb-3 border-b pb-3">
                <p className="text-sm font-bold capitalize">{new Intl.DateTimeFormat("es-US",{weekday:"short"}).format(d)}</p>
                <p className="text-xs text-slate-500">{d.getDate()} {new Intl.DateTimeFormat("es-US",{month:"short"}).format(d)}</p>
              </div>
              <div className="space-y-2">
                {dayJobs.map(j=><article key={j.id} className={"rounded-lg border-l-4 p-2 text-xs "+
                  (j.status==="cancelled"?"border-red-400 bg-red-50 opacity-75":
                   j.status==="completed"?"border-emerald-500 bg-emerald-50":
                   j.status==="pending_confirmation"?"border-amber-400 bg-amber-50":
                   "border-blue-500 bg-blue-50")}>
                  <p className="font-semibold">{timeLabel(j.start_time)}–{timeLabel(j.estimated_end_time)}</p>
                  <p className="mt-1 font-semibold">{j.properties?.property_name||"Propiedad"}</p>
                  <p className="mt-1 text-slate-600">{j.job_assignments?.map(a=>a.employees?.first_name).filter(Boolean).join(", ")||"Sin equipo"}</p>
                  <p className="mt-1 text-slate-500">{statuses[j.status]||j.status}</p>
                  <Link className="mt-2 inline-block font-semibold underline" href={"/jobs?edit="+j.id}>Ver / editar</Link>
                </article>)}
                {!dayJobs.length&&<p className="text-xs text-slate-400">Sin trabajos</p>}
              </div>
            </section>;
          })}
        </div>
      </div>}
    <p className="hint">Puedes cambiar fecha, horario, equipo o estado desde “Ver / editar”. Los cambios no modifican automáticamente otras visitas.</p>
  </div>;
}
