"use client";

import {FormEvent,useCallback,useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import {getEmployees,getJobs,getTimeEntries,message} from "@/lib/data";
import {displayDate,fullName,hoursWorked,localDate} from "@/lib/types";
import type {Employee,Job,TimeEntry} from "@/lib/types";

type ShiftForm={
  employee_id:string;job_id:string;start:string;end:string;break_minutes:string;notes:string;reason:string;
};
const toLocalInput=(iso:string)=>{
  const d=new Date(iso);
  const p=(v:number)=>String(v).padStart(2,"0");
  return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+"T"+p(d.getHours())+":"+p(d.getMinutes());
};
const blank=():ShiftForm=>({employee_id:"",job_id:"",start:toLocalInput(new Date().toISOString()),
  end:"",break_minutes:"0",notes:"",reason:""});
const when=(iso:string)=>new Intl.DateTimeFormat("es-US",{
  month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"
}).format(new Date(iso));

export default function HoursPage(){
  const [employees,setEmployees]=useState<Employee[]>([]);
  const [jobs,setJobs]=useState<Job[]>([]);
  const [entries,setEntries]=useState<TimeEntry[]>([]);
  const [form,setForm]=useState<ShiftForm>(blank);
  const [editing,setEditing]=useState<string|null>(null);
  const [open,setOpen]=useState(false);
  const [clockEmployee,setClockEmployee]=useState("");
  const [clockJob,setClockJob]=useState("");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [showVoided,setShowVoided]=useState(false);
  const [voiding,setVoiding]=useState<string|null>(null);
  const [voidReason,setVoidReason]=useState("");
  const [voidError,setVoidError]=useState("");
  const refresh=useCallback(async()=>{
    try {
      const [e,j,t]=await Promise.all([getEmployees(),getJobs(),getTimeEntries()]);
      setEmployees(e);setJobs(j);setEntries(t);setError("");
    } catch(e){setError(message(e));}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void Promise.resolve().then(refresh);},[refresh]);

  const employeeMap=useMemo(()=>new Map(employees.map(e=>[e.id,e])),[employees]);
  const jobMap=useMemo(()=>new Map(jobs.map(j=>[j.id,j])),[jobs]);
  const openShifts=entries.filter(t=>t.ended_at===null&&!t.voided_at);
  const activeEntries=entries.filter(t=>!t.voided_at);
  const visibleEntries=showVoided?entries:activeEntries;
  const last30=new Date();
  last30.setDate(last30.getDate()-30);
  const totalHours=activeEntries.filter(t=>new Date(t.started_at)>=last30)
    .reduce((sum,t)=>sum+(hoursWorked(t)||0),0);

  function startNew(){
    setForm(blank());setEditing(null);setError("");setOpen(true);
  }
  function startEdit(row:TimeEntry){
    setForm({employee_id:row.employee_id,job_id:row.job_id||"",
      start:toLocalInput(row.started_at),end:row.ended_at?toLocalInput(row.ended_at):"",
      break_minutes:String(row.break_minutes),notes:row.notes||"",reason:""});
    setEditing(row.id);setError("");setOpen(true);
  }
  async function saveShift(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setError("");setNotice("");
    const start=new Date(form.start);
    const end=form.end?new Date(form.end):null;
    const rest=Number(form.break_minutes);
    if(!form.employee_id||Number.isNaN(start.getTime())||(end&&Number.isNaN(end.getTime()))||
       (end&&end.getTime()<=start.getTime())||!Number.isInteger(rest)||rest<0||
       (end&&rest*60000>=end.getTime()-start.getTime())){
      setError("Revisa empleado, fechas, horas y descanso.");return;
    }
    if(editing&&!form.reason.trim()){
      setError("Debes explicar el motivo de la corrección.");return;
    }
    if(!editing&&!end){
      setError("Para registrar una jornada manualmente, indica el horario de salida. Para una jornada abierta usa Marcar llegada.");return;
    }
    setBusy(true);
    const payload={employee_id:form.employee_id,job_id:form.job_id||null,
      started_at:start.toISOString(),ended_at:end?end.toISOString():null,
      break_minutes:rest,notes:form.notes||null};
    const result=editing
      ? await supabase.from("time_entries").update({...payload,correction_reason:form.reason.trim()}).eq("id",editing)
      : await supabase.from("time_entries").insert({...payload,source:"admin_manual"});
    setBusy(false);
    if(result.error){setError(result.error.message);return;}
    setOpen(false);setNotice("Horas guardadas correctamente.");await refresh();
  }
  async function clockIn(){
    if(!clockEmployee){setError("Elige un empleado para marcar llegada.");return;}
    if(openShifts.some(t=>t.employee_id===clockEmployee)){
      setError("Este empleado ya tiene una jornada abierta.");return;
    }
    setBusy(true);setError("");setNotice("");
    const {error:dbError}=await supabase.from("time_entries").insert({
      employee_id:clockEmployee,job_id:clockJob||null,
      started_at:new Date().toISOString(),ended_at:null,break_minutes:0,source:"admin_clock"
    });
    setBusy(false);
    if(dbError){setError(dbError.message);return;}
    setClockEmployee("");setClockJob("");setNotice("Llegada registrada con la hora actual.");await refresh();
  }
  async function clockOut(shift:TimeEntry){
    setBusy(true);setError("");setNotice("");
    const {error:dbError}=await supabase.from("time_entries")
      .update({ended_at:new Date().toISOString()}).eq("id",shift.id).is("ended_at",null);
    setBusy(false);
    if(dbError){setError(dbError.message);return;}
    setNotice("Salida registrada. Verifica el descanso antes de preparar nómina.");await refresh();
  }
  async function voidShift(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!voiding||!voidReason.trim())return;
    setBusy(true);setVoidError("");setNotice("");
    const {error:dbError}=await supabase.from("time_entries")
      .update({voided_at:new Date().toISOString(),void_reason:voidReason.trim()})
      .eq("id",voiding).is("voided_at",null);
    setBusy(false);
    if(dbError){setVoidError(dbError.message);return;}
    setVoiding(null);setVoidReason("");setNotice("Jornada anulada. Se conserva en auditoría y ya no cuenta en los totales.");
    await refresh();
  }
  function exportCsv(){
    const headers=["Empleado","Trabajo","Entrada local","Salida local","Descanso minutos","Horas netas","Origen","Notas"];
    const rows=activeEntries.map(t=>[
      employeeMap.get(t.employee_id)?fullName(employeeMap.get(t.employee_id)!):"Desconocido",
      t.job_id?(jobMap.get(t.job_id)?.properties?.property_name||t.job_id):"",
      when(t.started_at),t.ended_at?when(t.ended_at):"",String(t.break_minutes),
      hoursWorked(t)?.toFixed(2)||"",t.source==="admin_clock"?"Marcado por admin":"Manual",t.notes||""
    ]);
    const csv=[headers,...rows].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\r\n");
    const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");link.href=url;link.download="cleaning-hours-"+localDate()+".csv";
    link.click();URL.revokeObjectURL(url);
  }
  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap justify-between gap-3">
      <div><h1 className="page-title">Registro de horas</h1>
        <p className="hint">Control de llegadas, salidas y descansos, administrado por los dueños.</p></div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-outline" type="button" onClick={exportCsv} disabled={loading||activeEntries.length===0}>Exportar CSV (sin anulados)</button>
        <button className="btn-primary" onClick={startNew}>+ Registrar jornada</button>
      </div>
    </header>
    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
      Registro operativo, no sistema de nómina. No descuenta impuestos automáticamente ni reemplaza recibos de pago,
      asesoría laboral o cálculos legales de overtime. Cuando los empleados solo avisan por mensaje, el dueño puede anotar esas horas aquí.
    </p>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="panel"><p className="hint">Jornadas abiertas</p><p className="mt-2 text-3xl font-bold">{openShifts.length}</p></div>
      <div className="panel"><p className="hint">Horas registradas, últimos 30 días</p><p className="mt-2 text-3xl font-bold">{totalHours.toFixed(2)} h</p></div>
    </div>

    {notice&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {error&&!open&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}

    <section className="panel space-y-3">
      <h2 className="text-xl font-semibold">Marcar llegada ahora (por el dueño)</h2>
      <p className="hint">Si un empleado avisa por teléfono, registra aquí su hora actual. Después presiona Marcar salida.</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm">Empleado
          <select className="field mt-1" value={clockEmployee} onChange={e=>setClockEmployee(e.target.value)}>
            <option value="">Elige empleado</option>
            {employees.filter(e=>e.is_active).map(e=><option key={e.id} value={e.id}>{fullName(e)}</option>)}
          </select>
        </label>
        <label className="text-sm">Trabajo (opcional)
          <select className="field mt-1" value={clockJob} onChange={e=>setClockJob(e.target.value)}>
            <option value="">Sin trabajo específico</option>
            {jobs.filter(j=>j.status!=="cancelled").sort((a,b)=>b.job_date.localeCompare(a.job_date)).slice(0,100).map(j=>
              <option key={j.id} value={j.id}>{displayDate(j.job_date)} — {j.properties?.property_name||"Trabajo"}</option>)}
          </select>
        </label>
        <button type="button" className="btn-primary" disabled={busy} onClick={()=>void clockIn()}>Marcar llegada</button>
      </div>
      {openShifts.map(t=><article className="rounded-lg border border-amber-200 bg-amber-50 p-3 sm:flex sm:items-center sm:justify-between" key={t.id}>
        <p className="text-sm"><strong>{employeeMap.get(t.employee_id)?fullName(employeeMap.get(t.employee_id)!):"Empleado"}</strong> · Llegó {when(t.started_at)}</p>
        <button type="button" className="btn-outline mt-2 text-sm sm:mt-0" disabled={busy} onClick={()=>void clockOut(t)}>Marcar salida ahora</button>
      </article>)}
    </section>

    {open&&<section className="panel">
      <div className="mb-4 flex justify-between"><h2 className="text-xl font-semibold">{editing?"Corregir jornada":"Registrar jornada manual"}</h2>
        <button className="btn-outline" onClick={()=>setOpen(false)}>Cerrar</button></div>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveShift}>
        <label>Empleado *
          <select required className="field mt-1" value={form.employee_id} onChange={e=>setForm({...form,employee_id:e.target.value})}>
            <option value="">Selecciona empleado</option>{employees.map(e=><option key={e.id} value={e.id}>{fullName(e)}</option>)}
          </select>
        </label>
        <label>Trabajo (opcional)
          <select className="field mt-1" value={form.job_id} onChange={e=>setForm({...form,job_id:e.target.value})}>
            <option value="">Sin trabajo asociado</option>
            {jobs.map(j=><option key={j.id} value={j.id}>{displayDate(j.job_date)} — {j.properties?.property_name||"Trabajo"}</option>)}
          </select>
        </label>
        <label>Entrada *<input required type="datetime-local" className="field mt-1" value={form.start}
          onChange={e=>setForm({...form,start:e.target.value})}/></label>
        <label>Salida {editing?"(vacío = turno abierto)":"*"}
          <input required={!editing} type="datetime-local" className="field mt-1" value={form.end}
            onChange={e=>setForm({...form,end:e.target.value})}/></label>
        <label>Descanso no trabajado (minutos)
          <input className="field mt-1" type="number" min="0" max="1440" step="1" value={form.break_minutes}
            onChange={e=>setForm({...form,break_minutes:e.target.value})}/></label>
        <label className="sm:col-span-2">Notas del registro<textarea className="field mt-1" rows={2} value={form.notes}
          onChange={e=>setForm({...form,notes:e.target.value})}/></label>
        {editing&&<label className="sm:col-span-2">Motivo de corrección *<textarea className="field mt-1" required rows={2}
          placeholder="Ej. Hora incorrecta anotada del mensaje de llegada" value={form.reason}
          onChange={e=>setForm({...form,reason:e.target.value})}/></label>}
        {error&&<p role="alert" className="sm:col-span-2 text-red-700">{error}</p>}
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" className="btn-primary" disabled={busy}>{busy?"Guardando…":"Guardar horas"}</button>
          <button type="button" className="btn-outline" onClick={()=>setOpen(false)}>Cancelar</button>
        </div>
      </form>
    </section>}

    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Jornadas registradas</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showVoided} onChange={e=>setShowVoided(e.target.checked)}/>
          Ver jornadas anuladas
        </label>
      </div>
      {loading?<p className="hint">Cargando horas…</p>:visibleEntries.map(t=><article className={"panel flex flex-wrap justify-between gap-3 "+(t.voided_at?"opacity-60":"")} key={t.id}>
        <div>
          <h3 className="font-semibold">{employeeMap.get(t.employee_id)?fullName(employeeMap.get(t.employee_id)!):"Empleado"}
            {t.voided_at&&<span className="ml-2 rounded bg-red-100 px-2 py-1 text-xs text-red-800">Anulado</span>}
          </h3>
          <p className="text-sm">{when(t.started_at)} → {t.ended_at?when(t.ended_at):"En curso"}</p>
          <p className="hint">Descanso: {t.break_minutes} min · Horas: {hoursWorked(t)?.toFixed(2)||"En curso"}
            {t.job_id?" · "+(jobMap.get(t.job_id)?.properties?.property_name||"Trabajo"):""}
          </p>
          {t.notes&&<p className="text-sm">{t.notes}</p>}
          {t.voided_at&&<p className="text-sm font-medium text-red-800">Motivo: {t.void_reason}</p>}
        </div>
        {!t.voided_at&&<div className="flex flex-wrap gap-2">
          <button className="btn-outline text-sm" type="button" onClick={()=>startEdit(t)}>Corregir</button>
          <button className="btn-outline text-sm" type="button" onClick={()=>{setVoiding(t.id);setVoidReason("");setVoidError("");}}>Anular</button>
        </div>}
      </article>)}
      {!loading&&!entries.length&&<div className="panel hint">Todavía no hay jornadas registradas.</div>}
    </section>
    {voiding&&<div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <form onSubmit={voidShift} role="dialog" aria-modal="true" aria-labelledby="void-shift-title"
        className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
        <h2 id="void-shift-title" className="text-xl font-bold">Anular jornada</h2>
        <p className="text-sm text-slate-600">La jornada dejará de contar para el total de horas. No se borrará del historial de auditoría.</p>
        <label className="block text-sm font-medium">Motivo *<textarea required className="field mt-1" rows={3}
          value={voidReason} onChange={e=>setVoidReason(e.target.value)} placeholder="Ej. Registro de llegada accidental"/></label>
        {voidError&&<p role="alert" className="text-sm text-red-700">{voidError}</p>}
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg bg-red-700 px-4 py-3 font-semibold text-white disabled:opacity-50" type="submit" disabled={busy}>{busy?"Anulando…":"Confirmar anulación"}</button>
          <button className="btn-outline" type="button" disabled={busy} onClick={()=>setVoiding(null)}>Volver</button>
        </div>
      </form>
    </div>}
    <p className="hint">Los CSV y las estadísticas excluyen las jornadas anuladas. La lista y el CSV muestran como máximo 500 registros recientes.</p>
  </div>;
}
