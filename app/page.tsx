"use client";
import Link from "next/link";
import {useCallback,useEffect,useState} from "react";
import {getClients,getEmployees,getJobs,message} from "@/lib/data";
import {displayDate,localDate,statuses,timeLabel} from "@/lib/types";
import type {Job} from "@/lib/types";
export default function DashboardPage(){
  const [jobs,setJobs]=useState<Job[]>([]);
  const [clients,setClients]=useState(0),[employees,setEmployees]=useState(0);
  const [loading,setLoading]=useState(true),[error,setError]=useState("");
  const refresh=useCallback(async()=>{
    try{
      const [j,c,e]=await Promise.all([getJobs(),getClients(),getEmployees()]);
      setJobs(j);setClients(c.filter(x=>x.is_active).length);
      setEmployees(e.filter(x=>x.is_active).length);setError("");
    }catch(e){setError(message(e));}finally{setLoading(false);}
  },[]);
  useEffect(()=>{void Promise.resolve().then(refresh);},[refresh]);
  const today=localDate();
  const todayJobs=jobs.filter(j=>j.job_date===today&&j.status!=="cancelled");
  const unassigned=jobs.filter(j=>j.job_date>=today&&j.status!=="cancelled"&&!j.job_assignments?.length);
  const pending=jobs.filter(j=>j.job_date>=today&&j.status==="pending_confirmation");
  const upcoming=jobs.filter(j=>j.job_date>=today&&j.status!=="cancelled").slice(0,8);
  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap justify-between gap-3">
      <div><h1 className="page-title">Inicio</h1><p className="hint">Lo importante para organizar la compañía hoy.</p></div>
      <Link className="btn-primary" href="/jobs">+ Programar limpieza</Link>
    </header>
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    {loading?<p className="hint">Cargando resumen…</p>:<>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Trabajos hoy",todayJobs.length],["Clientes activos",clients],
          ["Personal activo",employees],["Sin equipo próximo",unassigned.length]
        ].map(([label,value])=><div key={label} className="panel">
          <p className="hint">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p>
        </div>)}
      </section>
      <section className="panel space-y-3">
        <h2 className="text-lg font-semibold">Necesita atención</h2>
        <p className="text-sm">{pending.length} trabajos por confirmar con clientes</p>
        <p className="text-sm">{unassigned.length} trabajos próximos sin empleados asignados</p>
        <Link href="/jobs" className="inline-block text-sm font-semibold underline">Revisar trabajos</Link>
      </section>
      <section className="space-y-3">
        <div className="flex justify-between"><h2 className="text-lg font-semibold">Próximos trabajos</h2>
          <Link className="text-sm font-semibold underline" href="/calendar">Ver calendario</Link></div>
        {upcoming.map(j=><article key={j.id} className="panel flex flex-wrap justify-between gap-3">
          <div><h3 className="font-semibold">{j.properties?.property_name||"Propiedad"}</h3>
            <p className="hint">{displayDate(j.job_date)} · {timeLabel(j.start_time)}–{timeLabel(j.estimated_end_time)}</p>
            <p className="text-sm">Equipo: {j.job_assignments?.map(a=>a.employees?.first_name).filter(Boolean).join(", ")||"Sin asignar"}</p></div>
          <div className="flex items-center gap-3"><span className="text-xs text-slate-500">{statuses[j.status]||j.status}</span>
            <Link className="btn-outline text-sm" href={"/jobs?edit="+j.id}>Editar</Link></div>
        </article>)}
        {!upcoming.length&&<div className="panel hint">No hay trabajos próximos registrados.</div>}
      </section>
    </>}
  </div>;
}
