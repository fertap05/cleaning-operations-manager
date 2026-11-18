"use client";

import {FormEvent,useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {supabase} from "@/lib/supabase";
import {getJobs,getPayments,message} from "@/lib/data";
import {displayDate,fullName,localDate,money,paymentMethods,roundMoney,statuses} from "@/lib/types";
import type {Job,JobPayment} from "@/lib/types";

type PaymentForm = {job_id:string;amount:string;method:JobPayment["method"];received_on:string;reference:string;notes:string};
const blank=():PaymentForm=>({job_id:"",amount:"",method:"cash",received_on:localDate(),reference:"",notes:""});

export default function PaymentsPage(){
  const [jobs,setJobs]=useState<Job[]>([]);
  const [payments,setPayments]=useState<JobPayment[]>([]);
  const [form,setForm]=useState<PaymentForm>(blank);
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [onlyOutstanding,setOnlyOutstanding]=useState(false);
  const [voiding,setVoiding]=useState<string|null>(null);
  const [voidReason,setVoidReason]=useState("");
  const refresh=useCallback(async()=>{
    try {
      const [j,p]=await Promise.all([getJobs(),getPayments()]);
      setJobs(j);setPayments(p);setError("");
    } catch(e){setError(message(e));}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void Promise.resolve().then(refresh);},[refresh]);

  const totals=useMemo(()=>{
    const perJob=new Map<string,number>();
    for(const p of payments)if(!p.voided_at)
      perJob.set(p.job_id, roundMoney((perJob.get(p.job_id)||0)+Number(p.amount)));
    return perJob;
  },[payments]);

  const finished=jobs.filter(j=>j.status==="completed" && j.price!==null);
  const due=roundMoney(finished.reduce((sum,j)=>sum+Math.max(0,Number(j.price)- (totals.get(j.id)||0)),0));
  const received=roundMoney(payments.filter(p=>!p.voided_at).reduce((sum,p)=>sum+Number(p.amount),0));
  const pendingChecks=payments.filter(p=>!p.voided_at && p.method==="check" && !p.cleared_on);
  const checksAmount=roundMoney(pendingChecks.reduce((sum,p)=>sum+Number(p.amount),0));
  const outstanding=finished.filter(j=>Number(j.price)-(totals.get(j.id)||0)>0.005);
  const sortedJobs=[...jobs].sort((a,b)=>b.job_date.localeCompare(a.job_date));
  const visibleJobs=sortedJobs.filter(j=>!onlyOutstanding||outstanding.some(x=>x.id===j.id));

  function selectJob(id:string){
    const j=jobs.find(x=>x.id===id);
    setForm(f=>({...f,job_id:id,
      amount:j?.price===null || j?.price===undefined ? "" :
        String(Math.max(0,roundMoney(Number(j.price)-(totals.get(id)||0))))}));
  }
  async function addPayment(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setError("");setNotice("");
    const amount=Number(form.amount);
    if(!form.job_id||!Number.isFinite(amount)||amount<=0||!form.received_on){
      setError("Selecciona un trabajo, fecha y monto mayor de cero.");return;
    }
    const job=jobs.find(j=>j.id===form.job_id);
    if(!job || job.status==="cancelled"){
      setError("Elige un trabajo válido que no esté cancelado.");return;
    }
    setBusy(true);
    const {error:dbError}=await supabase.from("job_payments").insert({
      job_id:form.job_id,amount:roundMoney(amount),method:form.method,
      received_on:form.received_on,reference:form.reference.trim()||null,
      notes:form.notes.trim()||null
    });
    setBusy(false);
    if(dbError){setError(dbError.message);return;}
    setOpen(false);setNotice("Pago registrado. Si necesitas corregirlo, anúlalo con un motivo y crea otro.");
    setForm(blank());await refresh();
  }
  async function voidPayment(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!voiding||!voidReason.trim())return;
    setBusy(true);setError("");setNotice("");
    const {error:dbError}=await supabase.from("job_payments")
      .update({voided_at:new Date().toISOString(),void_reason:voidReason.trim()})
      .eq("id",voiding).is("voided_at",null);
    setBusy(false);
    if(dbError){setError(dbError.message);return;}
    setVoiding(null);setVoidReason("");setNotice("Pago anulado; el historial se conserva.");
    await refresh();
  }
  async function clearCheck(id:string){
    setBusy(true);setError("");setNotice("");
    const {error:dbError}=await supabase.from("job_payments")
      .update({cleared_on:localDate()}).eq("id",id).is("voided_at",null).is("cleared_on",null);
    setBusy(false);
    if(dbError){setError(dbError.message);return;}
    setNotice("Cheque marcado como cobrado/depositado.");await refresh();
  }

  const chosen=jobs.find(j=>j.id===form.job_id);
  const currentBalance=chosen?.price===null || chosen?.price===undefined
    ? null :roundMoney(Number(chosen.price)-(totals.get(chosen.id)||0));

  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="page-title">Pagos y saldos</h1>
        <p className="hint">Efectivo, cheque, Venmo, pagos parciales y dinero por cobrar.</p></div>
      <button className="btn-primary" onClick={()=>{setForm(blank());setError("");setOpen(true);}}>+ Registrar pago</button>
    </header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Pendiente de cobrar",money(due)],
        ["Pagos registrados",money(received)],
        ["Cheques por cobrar/depositar",money(checksAmount)],
        ["Trabajos terminados con saldo",String(outstanding.length)]
      ].map(([label,value])=><div className="panel" key={label}>
        <p className="hint">{label}</p><p className="mt-2 text-2xl font-bold">{loading?"…":value}</p>
      </div>)}
    </div>
    <p className="hint">El saldo por cobrar considera solo trabajos marcados como <strong>Terminados</strong>. Pagos adelantados quedan registrados, pero no crean una deuda antes de prestar el servicio. Un cheque registrado puede seguir pendiente de depósito.</p>
    {notice&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {error&&!open&&!voiding&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}

    {open&&<section className="panel max-w-3xl space-y-4">
      <div className="flex justify-between"><h2 className="text-xl font-semibold">Registrar un abono</h2>
        <button className="btn-outline text-sm" onClick={()=>setOpen(false)}>Cerrar</button></div>
      <form onSubmit={addPayment} className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">Trabajo y cliente *
          <select required className="field mt-1" value={form.job_id} onChange={e=>selectJob(e.target.value)}>
            <option value="">Selecciona el trabajo</option>
            {sortedJobs.filter(j=>j.status!=="cancelled").map(j=><option value={j.id} key={j.id}>
              {displayDate(j.job_date)} — {j.properties?.property_name||"Propiedad"} — {j.properties?.clients?fullName(j.properties.clients):"Sin cliente"}
            </option>)}
          </select>
        </label>
        {chosen&&<p className="sm:col-span-2 rounded-lg bg-slate-50 p-3 text-sm">
          Trabajo: {statuses[chosen.status]||chosen.status} · Precio: {money(chosen.price)} ·
          Saldo sin cubrir: {currentBalance===null?"Sin precio":money(currentBalance)}
        </p>}
        <label>Monto recibido ($) *<input required className="field mt-1" type="number" min="0.01" step="0.01"
          value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label>
        <label>Método<select className="field mt-1" value={form.method} onChange={e=>setForm({...form,method:e.target.value as JobPayment["method"]})}>
          {Object.entries(paymentMethods).map(([value,label])=><option value={value} key={value}>{label}</option>)}
        </select></label>
        <label>Fecha recibida<input required type="date" className="field mt-1" value={form.received_on}
          onChange={e=>setForm({...form,received_on:e.target.value})}/></label>
        <label>Referencia (opcional)<input className="field mt-1" maxLength={100} value={form.reference}
          placeholder={form.method==="check"?"Número de cheque":"Referencia o nota"}
          onChange={e=>setForm({...form,reference:e.target.value})}/></label>
        <label className="sm:col-span-2">Notas<textarea className="field mt-1" rows={2} value={form.notes}
          onChange={e=>setForm({...form,notes:e.target.value})}/></label>
        {currentBalance!==null&&Number(form.amount)>currentBalance+0.005&&<p className="sm:col-span-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Este pago supera el saldo conocido. Verifica si incluye propina o adelanto.
        </p>}
        {error&&<p role="alert" className="sm:col-span-2 text-red-700">{error}</p>}
        <div className="flex gap-2 sm:col-span-2"><button className="btn-primary" type="submit" disabled={busy}>{busy?"Guardando…":"Guardar pago"}</button>
          <button className="btn-outline" type="button" onClick={()=>setOpen(false)}>Cancelar</button></div>
      </form>
    </section>}

    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Saldos por trabajo</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyOutstanding}
          onChange={e=>setOnlyOutstanding(e.target.checked)}/> Solo pendientes</label>
      </div>
      {loading?<p className="hint">Cargando pagos…</p>:visibleJobs.map(j=>{
        const paid=totals.get(j.id)||0;
        const balance=j.price===null?null:roundMoney(Number(j.price)-paid);
        return <article key={j.id} className="panel flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">{j.properties?.property_name||"Propiedad"}</h3>
            <p className="hint">{displayDate(j.job_date)} · {j.properties?.clients?fullName(j.properties.clients):"Sin cliente"} · {statuses[j.status]||j.status}</p>
            <p className="mt-1 text-sm">Precio {money(j.price)} · Pagado {money(paid)}
              {" · "}{j.status==="completed"?"Saldo":"Por cubrir"}: {balance===null?"Precio sin definir":money(balance)}
            </p>
          </div>
          <button className="btn-outline text-sm" onClick={()=>{setForm({...blank(),job_id:j.id});setOpen(true);setError("");}}>Agregar abono</button>
        </article>;
      })}
      {!loading&&!visibleJobs.length&&<div className="panel hint">No hay trabajos para este filtro.</div>}
    </section>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Historial de pagos</h2>
      {payments.map(p=>{
        const j=jobs.find(x=>x.id===p.job_id);
        return <div key={p.id} className="panel flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={"font-semibold "+(p.voided_at?"line-through text-slate-400":"")}>{money(Number(p.amount))} · {paymentMethods[p.method]}</p>
            <p className="hint">{displayDate(p.received_on)} · {j?.properties?.property_name||"Trabajo"}</p>
            {p.reference&&<p className="text-xs text-slate-500">Referencia: {p.reference}</p>}
            {p.method==="check"&&!p.voided_at&&<p className="text-xs font-medium text-amber-800">
              {p.cleared_on?"Cheque cobrado: "+displayDate(p.cleared_on):"Cheque pendiente de cobro/depósito"}
            </p>}
            {p.voided_at&&<p className="text-sm text-red-700">Anulado: {p.void_reason}</p>}
          </div>
          {!p.voided_at&&<div className="flex flex-wrap gap-2">
            {p.method==="check"&&!p.cleared_on&&<button disabled={busy} className="btn-outline text-sm"
              onClick={()=>void clearCheck(p.id)}>Marcar cheque cobrado</button>}
            <button disabled={busy} className="btn-outline text-sm"
              onClick={()=>{setVoiding(p.id);setVoidReason("");setError("");}}>Anular</button>
          </div>}
        </div>;
      })}
      {!loading&&!payments.length&&<div className="panel hint">Todavía no hay pagos registrados.</div>}
    </section>

    {voiding&&<div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <form onSubmit={voidPayment} role="dialog" aria-modal="true" aria-labelledby="void-title"
        className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
        <h2 id="void-title" className="text-xl font-bold">Anular pago</h2>
        <p className="text-sm text-slate-600">Conservaremos el registro en el historial. Para corregirlo, registra luego el monto correcto.</p>
        <label className="block text-sm font-medium">Motivo *
          <textarea required className="field mt-1" value={voidReason}
            onChange={e=>setVoidReason(e.target.value)} rows={2}/></label>
        {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2"><button disabled={busy} className="rounded-lg bg-red-700 px-4 py-3 text-white" type="submit">{busy?"Guardando…":"Anular pago"}</button>
          <button className="btn-outline" type="button" disabled={busy} onClick={()=>setVoiding(null)}>Volver</button></div>
      </form>
    </div>}
    <p className="hint">Vista inicial limitada a los últimos 500 pagos. No sustituye conciliación bancaria ni contabilidad fiscal.</p>
    <Link href="/jobs" className="text-sm font-semibold underline">Gestionar trabajos</Link>
  </div>;
}
