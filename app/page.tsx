"use client";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useState} from "react";
import {getClients,getEmployees,getJobs,getPayments,getTimeEntries,message} from "@/lib/data";
import {displayDate,localDate,money,roundMoney,statuses,timeLabel} from "@/lib/types";
import type {Job,JobPayment,TimeEntry} from "@/lib/types";

export default function DashboardPage(){
  const [jobs,setJobs]=useState<Job[]>([]);
  const [clients,setClients]=useState(0),[employees,setEmployees]=useState(0);
  const [payments,setPayments]=useState<JobPayment[]|null>(null);
  const [timeEntries,setTimeEntries]=useState<TimeEntry[]|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState("");
  const refresh=useCallback(async()=>{
    try {
      const [j,c,e,p,t]=await Promise.all([
        getJobs(),getClients(),getEmployees(),
        getPayments().catch(()=>null),
        getTimeEntries().catch(()=>null)
      ]);
      setJobs(j);setClients(c.filter(x=>x.is_active).length);
      setEmployees(e.filter(x=>x.is_active).length);
      setPayments(p);setTimeEntries(t);
      setError("");
    } catch(e){setError(message(e));}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void Promise.resolve().then(refresh);},[refresh]);

  const today=localDate();
  const upcoming=useMemo(()=>jobs.filter(j=>j.job_date>=today && j.status!=="cancelled").slice(0,10),[jobs,today]);
  const todayJobs=jobs.filter(j=>j.job_date===today && j.status!=="cancelled");
  const unassigned=jobs.filter(j=>j.job_date>=today && j.status!=="cancelled"&&!j.job_assignments?.length);
  const pending=jobs.filter(j=>j.job_date>=today && j.status==="pending_confirmation");
  const forgotten=jobs.filter(j=>j.job_date<today && j.status!=="completed" && j.status!=="cancelled");
  const paidByJob=useMemo(()=>{
    const totals=new Map<string,number>();
    for(const p of payments||[])if(!p.voided_at){
      totals.set(p.job_id,roundMoney((totals.get(p.job_id)||0)+Number(p.amount)));
    }
    return totals;
  },[payments]);
  const due=payments===null?null:roundMoney(jobs
    .filter(j=>j.status==="completed" && j.price!==null)
    .reduce((sum,j)=>sum+Math.max(0,Number(j.price)-(paidByJob.get(j.id)||0)),0));
  const checkCount=payments?.filter(p=>p.method==="check"&&!p.voided_at&&!p.cleared_on).length;
  const openShifts=timeEntries?.filter(t=>!t.ended_at&&!t.voided_at).length;
  const attention=[
    {label:"Por confirmar con clientes",value:pending.length,href:"/jobs"},
    {label:"Próximos trabajos sin equipo",value:unassigned.length,href:"/jobs"},
    {label:"Trabajos pasados por cerrar",value:forgotten.length,href:"/jobs"},
    {label:"Cheques por depositar",value:checkCount,href:"/payments"},
    {label:"Turnos con salida pendiente",value:openShifts,href:"/hours"}
  ];
  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap justify-between gap-3">
      <div><h1 className="page-title">Inicio</h1>
        <p className="hint">Todo lo importante para organizar la compañía.</p></div>
      <Link className="btn-primary" href="/jobs">+ Programar limpieza</Link>
    </header>
    {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    {loading?<p className="hint">Cargando resumen…</p>:<>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          ["Trabajos hoy",String(todayJobs.length),"Visitas activas de hoy"],
          ["Clientes activos",String(clients),"Contactos habilitados"],
          ["Personal activo",String(employees),"Incluidos los dueños"],
          ["Pendiente de cobrar",due===null?"—":money(due),"Solo trabajos terminados"],
          ["Por confirmar",String(pending.length),"Antes de enviar al equipo"],
          ["Cheques pendientes",checkCount===undefined?"—":String(checkCount),"Sin depósito/cobro registrado"]
        ].map(([label,value,caption])=><div className="panel" key={label}>
          <p className="hint">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{caption}</p>
        </div>)}
      </div>
      {(payments===null||timeEntries===null)&&
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Las nuevas funciones de Pagos y Horas requieren ejecutar la migración SQL
          <code> 20261118_finance_time.sql </code> en Supabase. El calendario actual sigue disponible.
        </p>}
      <section className="panel space-y-3">
        <div className="flex justify-between gap-2"><h2 className="text-lg font-semibold">Necesita atención</h2><span className="text-sm text-slate-500">Recordatorios dentro del panel</span></div>
        {attention.filter(a=>a.value!==undefined).map(a=><div key={a.label} className="flex items-center justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
          <span>{a.label}</span>
          <Link className={"rounded-lg px-3 py-1 font-semibold underline "+(a.value?"bg-amber-50 text-amber-900":"text-slate-500")}
            href={a.href}>{a.value}</Link>
        </div>)}
      </section>
      <section className="space-y-3">
        <div className="flex justify-between gap-2"><h2 className="text-lg font-semibold">Próximos trabajos</h2>
          <Link className="text-sm font-semibold underline" href="/calendar">Ver calendario</Link></div>
        {upcoming.map(j=><article key={j.id} className="panel flex flex-wrap justify-between gap-3">
          <div>
            <h3 className="font-semibold">{j.properties?.property_name||"Propiedad"}</h3>
            <p className="hint">{displayDate(j.job_date)} · {timeLabel(j.start_time)}–{timeLabel(j.estimated_end_time)}</p>
            <p className="text-sm">Equipo: {j.job_assignments?.map(a=>a.employees?.first_name).filter(Boolean).join(", ")||"Sin asignar"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-500">{statuses[j.status]||j.status}</span>
            <Link className="btn-outline text-sm" href={"/jobs?edit="+j.id}>Editar</Link>
          </div>
        </article>)}
        {!upcoming.length&&<div className="panel hint">No hay trabajos próximos registrados.</div>}
      </section>
      <div className="flex flex-wrap gap-2">
        <Link className="btn-outline" href="/payments">Ver pagos</Link>
        <Link className="btn-outline" href="/hours">Revisar horas</Link>
      </div>
    </>}
  </div>;
}
