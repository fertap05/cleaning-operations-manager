"use client";

import Link from "next/link";
import {FormEvent, useCallback, useEffect, useMemo, useState} from "react";
import {supabase} from "@/lib/supabase";
import {getJobs, message} from "@/lib/data";
import {addDays, displayDate, localDate, monday, statuses, timeLabel} from "@/lib/types";
import type {Job} from "@/lib/types";

type Action = "confirm" | "reschedule" | "cancel";
type Draft = {date: string; start: string; end: string; reason: string};
const minutes = (time: string) => {
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
};

export default function CalendarPage() {
  const [week, setWeek] = useState(() => monday(new Date()));
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Job | null>(null);
  const [action, setAction] = useState<Action>("reschedule");
  const [draft, setDraft] = useState<Draft>({date:"", start:"", end:"", reason:""});
  const [saving, setSaving] = useState(false);
  const [showCancelled, setShowCancelled] = useState(true);
  const [employeeFilter,setEmployeeFilter] = useState("all");

  const refresh = useCallback(async () => {
    try {
      setJobs(await getJobs());
      setError("");
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);

  const days = useMemo(() => Array.from({length: 7}, (_, i) => addDays(week, i)), [week]);
  const start = localDate(week);
  const end = localDate(days[6]);
  const teams=useMemo(()=>{
    const map=new Map<string,string>();
    jobs.flatMap(j=>j.job_assignments||[]).forEach(a=>{if(a.employees)map.set(a.employee_id,[a.employees.first_name,a.employees.last_name].filter(Boolean).join(" "));});
    return [...map.entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  },[jobs]);
  const visible=jobs.filter(j=>j.job_date>=start&&j.job_date<=end&&
    (showCancelled||j.status!=="cancelled")&&
    (employeeFilter==="all"||j.job_assignments?.some(a=>a.employee_id===employeeFilter)));
  const today = localDate();

  function openAction(job:Job, nextAction:Action) {
    setSelected(job);
    setAction(nextAction);
    setDraft({
      date: job.job_date,
      start: job.start_time?.slice(0, 5) || "",
      end: job.estimated_end_time?.slice(0, 5) || "",
      reason: ""
    });
    setError("");
  }

  const warnings = useMemo(() => {
    if (!selected || action !== "reschedule" || !draft.date || !draft.start || !draft.end) {
      return [];
    }
    const crew = new Set((selected.job_assignments || []).map(a => a.employee_id));
    const startMinutes = minutes(draft.start);
    const endMinutes = minutes(draft.end);
    return jobs
      .filter(j => j.id !== selected.id && j.status !== "cancelled" &&
        j.job_date === draft.date && j.start_time && j.estimated_end_time &&
        (j.job_assignments || []).some(a => crew.has(a.employee_id)))
      .flatMap(j => {
        const otherStart = minutes(j.start_time!);
        const otherEnd = minutes(j.estimated_end_time!);
        const overlap = startMinutes < otherEnd && endMinutes > otherStart;
        const close = !overlap && Math.min(
          Math.abs(startMinutes - otherEnd),
          Math.abs(otherStart - endMinutes)
        ) < 30;
        if (!overlap && !close) return [];
        const shared = (j.job_assignments || [])
          .filter(a => crew.has(a.employee_id))
          .map(a => a.employees?.first_name || "Empleado")
          .join(", ");
        return [(overlap ? "Choque de horario: " : "Menos de 30 minutos entre trabajos: ") +
          shared + " también trabaja en " + (j.properties?.property_name || "otro lugar")];
      });
  }, [selected, action, draft, jobs]);

  async function saveAction(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || saving) return;
    if (action === "reschedule" && (!draft.date ||
      (draft.start && draft.end && minutes(draft.end) <= minutes(draft.start)))) {
      setError("Revisa la fecha y las horas: el final debe ser posterior al inicio.");
      return;
    }
    if (action === "cancel" && !draft.reason.trim()) {
      setError("Escribe por qué se canceló el trabajo.");
      return;
    }
    setSaving(true); setError(""); setNotice("");
    const {error:saveError} = await supabase.rpc("save_job", {
      p_property_id: selected.property_id,
      p_job_date: action === "reschedule" ? draft.date : selected.job_date,
      p_start_time: action === "reschedule" ? (draft.start || null) : selected.start_time,
      p_end_time: action === "reschedule" ? (draft.end || null) : selected.estimated_end_time,
      p_status: action === "confirm" ? "confirmed" :
        action === "cancel" ? "cancelled" : "pending_confirmation",
      p_price: selected.price,
      p_employee_ids: (selected.job_assignments || []).map(a => a.employee_id),
      p_job_id: selected.id,
      p_employee_notes: selected.employee_notes,
      p_private_notes: selected.private_notes,
      p_is_extra_job: selected.is_extra_job,
      p_cancellation_reason: action === "cancel" ? draft.reason.trim() : null
    });
    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }
    setSelected(null);
    setNotice(action === "confirm" ? "Limpieza confirmada." :
      action === "cancel" ? "Limpieza cancelada (registro conservado)." :
      "Limpieza reprogramada. Quedó pendiente de confirmar con el cliente.");
    if (action === "reschedule") {
      const [y,m,d] = draft.date.split("-").map(Number);
      setWeek(monday(new Date(y,m-1,d)));
    }
    await refresh();
    setSaving(false);
  }

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="page-title">Calendario semanal</h1>
        <p className="hint">Organiza los equipos, confirma y cambia limpiezas fácilmente.</p>
      </div>
      <div className="no-print flex flex-wrap gap-2"><button type="button" className="btn-outline" onClick={()=>window.print()}>Imprimir semana</button><Link className="btn-primary" href="/jobs">+ Nuevo trabajo</Link></div>
    </header>

    <div className="panel flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-semibold">{displayDate(start)} — {displayDate(end)}</h2>
        <p className="hint">{visible.length} trabajos esta semana</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="no-print flex items-center gap-2 text-sm">Empleado
          <select aria-label="Filtrar empleado" className="field !w-auto !py-2" value={employeeFilter} onChange={e=>setEmployeeFilter(e.target.value)}>
            <option value="all">Todos</option>{teams.map(([id,name])=><option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className="mr-2 no-print flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showCancelled}
            onChange={e=>setShowCancelled(e.target.checked)}/> Ver cancelados
        </label>
        <button className="btn-outline no-print" onClick={()=>setWeek(addDays(week,-7))}>← Anterior</button>
        <button className="btn-outline no-print" onClick={()=>setWeek(monday(new Date()))}>Esta semana</button>
        <button className="btn-outline no-print" onClick={()=>setWeek(addDays(week,7))}>Siguiente →</button>
      </div>
    </div>

    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {error && !selected && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}

    {loading ? <p className="hint">Cargando calendario…</p> :
      <div className="pb-2">
        <div className="print-calendar grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {days.map(d => {
            const key = localDate(d);
            const dayJobs = visible.filter(j=>j.job_date===key)
              .sort((a,b)=>String(a.start_time).localeCompare(String(b.start_time)));
            return <section key={key} className={"print-day min-h-[180px] rounded-xl border bg-white p-3 xl:min-h-[420px] "+
              (key === today ? "border-slate-900" : "border-slate-200")}>
              <div className="mb-3 border-b pb-3">
                <p className="text-sm font-bold capitalize">{new Intl.DateTimeFormat("es-US",{weekday:"short"}).format(d)}</p>
                <p className="text-xs text-slate-500">{d.getDate()} {new Intl.DateTimeFormat("es-US",{month:"short"}).format(d)}</p>
              </div>
              <div className="space-y-2">
                {dayJobs.map(j => <article key={j.id} className={"rounded-lg border-l-4 p-2 text-xs "+
                  (j.status==="cancelled" ? "border-red-400 bg-red-50 opacity-75" :
                  j.status==="completed" ? "border-emerald-500 bg-emerald-50" :
                  j.status==="pending_confirmation" ? "border-amber-400 bg-amber-50" :
                  "border-blue-500 bg-blue-50")}>
                  <p className="font-semibold">{timeLabel(j.start_time)}–{timeLabel(j.estimated_end_time)}</p>
                  <p className="mt-1 font-semibold">{j.properties?.property_name || "Propiedad"}</p>
                  <p className="mt-1 text-slate-600">{j.job_assignments?.map(a=>a.employees?.first_name).filter(Boolean).join(", ") || "Sin equipo"}</p>
                  <p className="mt-1 text-slate-600">{[j.properties?.address_line1,j.properties?.city].filter(Boolean).join(", ")}</p>
                  <p className="mt-1 text-slate-500">{statuses[j.status] || j.status}</p>
                  <div className="no-print mt-2 flex flex-wrap gap-x-3 gap-y-2">
                    {j.status === "pending_confirmation" && <button type="button"
                      className="font-semibold text-emerald-800 underline"
                      onClick={()=>openAction(j,"confirm")}>Confirmar</button>}
                    {j.status !== "cancelled" && j.status !== "completed" && <>
                      <button type="button" className="font-semibold text-blue-900 underline"
                        onClick={()=>openAction(j,"reschedule")}>Mover</button>
                      <button type="button" className="font-semibold text-red-800 underline"
                        onClick={()=>openAction(j,"cancel")}>Cancelar</button>
                    </>}
                    <Link className="font-semibold underline" href={"/jobs?edit="+j.id}>Editar</Link>
                  </div>
                </article>)}
                {!dayJobs.length && <p className="text-xs text-slate-400">Sin trabajos</p>}
              </div>
            </section>;
          })}
        </div>
      </div>}

    <p className="hint no-print">Al mover una limpieza se marca «Por confirmar» para que puedas consultar al cliente. El calendario avisa si un empleado ya está ocupado.</p>

    {selected && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/40 p-4"
      onClick={event=>{if(event.target===event.currentTarget&&!saving)setSelected(null);}}>
      <section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        role="dialog" aria-modal="true" aria-labelledby="calendar-action-title">
        <h2 id="calendar-action-title" className="mb-2 text-xl font-bold">
          {action==="confirm"?"Confirmar limpieza":action==="cancel"?"Cancelar limpieza":"Reprogramar limpieza"}
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          {selected.properties?.property_name} · {displayDate(selected.job_date)} · {timeLabel(selected.start_time)}
        </p>
        <form onSubmit={saveAction} className="space-y-4">
          {action==="reschedule" && <>
            <label className="block text-sm font-medium">Nueva fecha
              <input required type="date" className="field mt-1" value={draft.date}
                onChange={e=>setDraft({...draft,date:e.target.value})}/>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium">Comienzo
                <input type="time" className="field mt-1" value={draft.start}
                  onChange={e=>setDraft({...draft,start:e.target.value})}/>
              </label>
              <label className="text-sm font-medium">Final estimado
                <input type="time" className="field mt-1" value={draft.end}
                  onChange={e=>setDraft({...draft,end:e.target.value})}/>
              </label>
            </div>
            <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
              Mantendremos la propiedad y el equipo. Para cambiarlos usa «Editar».
              La nueva fecha quedará pendiente de confirmar con el cliente.
            </p>
            {warnings.length>0 && <div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Revisa estos posibles conflictos:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {[...new Set(warnings)].map((warning,i)=><li key={i}>{warning}</li>)}
              </ul>
              <p className="mt-2">Son advertencias, no bloqueos automáticos.</p>
            </div>}
          </>}
          {action==="confirm" && <p className="text-sm">¿El cliente confirmó que podemos realizar esta limpieza en la fecha y el horario actuales?</p>}
          {action==="cancel" && <>
            <label className="block text-sm font-medium">Motivo de cancelación *
              <textarea required className="field mt-1" rows={3}
                placeholder="Ej. El cliente no puede recibir al equipo"
                value={draft.reason} onChange={e=>setDraft({...draft,reason:e.target.value})}/>
            </label>
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Conservaremos el trabajo como cancelado. No se borrará de la base de datos.</p>
          </>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={saving} className="btn-outline" onClick={()=>setSelected(null)}>Volver</button>
            <button type="submit" disabled={saving}
              className={action==="cancel"?"rounded-lg bg-red-700 px-4 py-3 font-semibold text-white disabled:opacity-50":"btn-primary"}>
              {saving?"Guardando…":action==="confirm"?"Sí, confirmar":action==="cancel"?"Confirmar cancelación":"Guardar nueva fecha"}
            </button>
          </div>
        </form>
      </section>
    </div>}
  </div>;
}
