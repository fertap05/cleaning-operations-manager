"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {getEmployees,getJobs,getPayments,getTimeEntries,message} from "@/lib/data";
import {fullName,hoursWorked,localDate,money,paymentMethods,roundMoney} from "@/lib/types";
import type {Employee,Job,JobPayment,TimeEntry} from "@/lib/types";

export default function ReportsPage(){
  const [month,setMonth]=useState(()=>localDate().slice(0,7));
  const [jobs,setJobs]=useState<Job[]>([]);
  const [payments,setPayments]=useState<JobPayment[]>([]);
  const [entries,setEntries]=useState<TimeEntry[]>([]);
  const [employees,setEmployees]=useState<Employee[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const refresh=useCallback(async()=>{
    try {
      const [j,p,t,e]=await Promise.all([getJobs(),getPayments(),getTimeEntries(),getEmployees()]);
      setJobs(j);setPayments(p);setEntries(t);setEmployees(e);setError("");
    }catch(e){setError(message(e));}finally{setLoading(false);}
  },[]);
  useEffect(()=>{void Promise.resolve().then(refresh);},[refresh]);
  const stats=useMemo(()=>{
    const jobList=jobs.filter(j=>j.job_date.startsWith(month));
    const completed=jobList.filter(j=>j.status==="completed");
    const cancelled=jobList.filter(j=>j.status==="cancelled");
    const completedValue=roundMoney(completed.reduce((sum,j)=>sum+Number(j.price||0),0));
    const received=payments.filter(p=>!p.voided_at&&p.received_on.startsWith(month));
    const receivedValue=roundMoney(received.reduce((sum,p)=>sum+Number(p.amount),0));
    const methodTotals=Object.entries(paymentMethods).map(([code,label])=>({
      code,label,
      total:roundMoney(received.filter(p=>p.method===code).reduce((sum,p)=>sum+Number(p.amount),0))
    }));
    const monthEntries=entries.filter(t=>!t.voided_at&&localDate(new Date(t.started_at)).startsWith(month));
    const hoursByEmployee=employees.map(e=>({
      id:e.id,name:fullName(e),
      hours:Math.round(monthEntries.filter(t=>t.employee_id===e.id)
        .reduce((sum,t)=>sum+(hoursWorked(t)||0),0)*100)/100
    })).filter(x=>x.hours>0).sort((a,b)=>b.hours-a.hours);
    const activePayments=payments.filter(p=>!p.voided_at);
    const pendingChecks=activePayments.filter(p=>p.method==="check"&&!p.cleared_on);
    const totalHours=roundMoney(hoursByEmployee.reduce((sum,e)=>sum+e.hours,0));
    return {jobList,completed,cancelled,completedValue,receivedValue,methodTotals,
      monthEntries,hoursByEmployee,totalHours,
      checkAmount:roundMoney(pendingChecks.reduce((sum,p)=>sum+Number(p.amount),0))};
  },[jobs,payments,entries,employees,month]);
  function exportCsv(){
    const head=["Mes","Concepto","Valor"];
    const rows=[
      [month,"Trabajos terminados",String(stats.completed.length)],
      [month,"Valor servicios terminados",stats.completedValue.toFixed(2)],
      [month,"Pagos registrados en el mes",stats.receivedValue.toFixed(2)],
      [month,"Limpiezas canceladas",String(stats.cancelled.length)],
      [month,"Horas registradas",stats.totalHours.toFixed(2)],
      ...stats.methodTotals.map(m=>[month,"Pagos por "+m.label,m.total.toFixed(2)]),
      ...stats.hoursByEmployee.map(e=>[month,"Horas de "+e.name,e.hours.toFixed(2)])
    ];
    const csv=[head,...rows].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\r\n");
    const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="cleaning-report-"+month+".csv";a.click();URL.revokeObjectURL(url);
  }
  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="page-title">Reportes</h1>
        <p className="hint">Resumen operativo mensual; distingue servicios, cobros y horas trabajadas.</p></div>
      <button className="btn-outline" disabled={loading} onClick={exportCsv}>Exportar reporte CSV</button>
    </header>
    <section className="panel max-w-lg">
      <label className="block font-medium" htmlFor="report-month">Mes a revisar</label>
      <input id="report-month" className="field mt-2" type="month" value={month} onChange={e=>setMonth(e.target.value)}/>
    </section>
    {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    {loading?<p className="hint">Cargando reporte…</p>:<>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          ["Limpiezas terminadas",String(stats.completed.length)],
          ["Valor de servicios terminados",money(stats.completedValue)],
          ["Cobros recibidos en el mes",money(stats.receivedValue)],
          ["Trabajos cancelados",String(stats.cancelled.length)],
          ["Horas registradas",stats.totalHours.toFixed(2)+" h"],
          ["Cheques pendientes (todas las fechas)",money(stats.checkAmount)]
        ].map(([name,val])=><div className="panel" key={name}>
          <p className="hint">{name}</p><p className="mt-2 text-2xl font-bold">{val}</p>
        </div>)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="panel">
          <h2 className="text-lg font-semibold">Métodos de pago</h2>
          <div className="mt-4 space-y-2">
            {stats.methodTotals.map(m=><div key={m.code} className="flex justify-between gap-2 border-b border-slate-100 py-2 text-sm">
              <span>{m.label}</span><strong>{money(m.total)}</strong>
            </div>)}
          </div>
        </section>
        <section className="panel">
          <h2 className="text-lg font-semibold">Horas por empleado</h2>
          <div className="mt-4 space-y-2">
            {stats.hoursByEmployee.map(e=><div key={e.id} className="flex justify-between gap-2 border-b border-slate-100 py-2 text-sm">
              <span>{e.name}</span><strong>{e.hours.toFixed(2)} h</strong>
            </div>)}
            {!stats.hoursByEmployee.length&&<p className="hint">No hay horas registradas para este mes.</p>}
          </div>
        </section>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/payments" className="btn-outline">Pagos pendientes</Link>
        <Link href="/hours" className="btn-outline">Registros de horas</Link>
        <Link href="/calendar" className="btn-outline">Ver calendario</Link>
      </div>
      <p className="hint">«Cobros recibidos» se calcula por fecha de pago. «Valor de servicios terminados» se calcula por fecha del trabajo. Son cifras distintas; ninguna representa beneficio neto, impuestos ni contabilidad oficial. Reportes preliminares: los datos recientes de pagos y horas están limitados a 500 registros por categoría.</p>
    </>}
  </div>;
}
