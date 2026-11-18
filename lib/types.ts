export type Client = {
  id: string; first_name: string; last_name: string | null;
  phone: string | null; secondary_phone: string | null; email: string | null;
  general_notes: string | null; preferred_contact_method: string | null;
  is_active: boolean; created_at: string;
};
export type Property = {
  id: string; client_id: string; property_name: string; address_line1: string;
  address_line2: string | null; city: string | null; state: string | null;
  zip_code: string | null; property_type: string | null; access_type: string | null;
  usual_price: number | null; estimated_duration_minutes: number | null;
  usual_day_of_week: number | null; usual_start_time: string | null;
  frequency_type: string | null; employee_notes: string | null;
  private_notes: string | null; is_active: boolean;
  clients?: Pick<Client, "first_name" | "last_name"> | null;
};
export type Employee = {
  id: string; first_name: string; last_name: string | null; phone: string | null;
  role: string; is_owner: boolean; is_active: boolean;
  default_hourly_rate: number | null; general_notes: string | null;
};
export type Job = {
  id: string; property_id: string; job_date: string;
  start_time: string | null; estimated_end_time: string | null;
  status: string; price: number | null; employee_notes: string | null;
  private_notes: string | null; cancellation_reason: string | null;
  is_extra_job: boolean;
  properties?: (Pick<Property,"id" | "property_name" | "address_line1" | "city" | "client_id"> & {
    clients?: Pick<Client,"first_name" | "last_name"> | null
  }) | null;
  job_assignments?: Array<{employee_id: string; employees?: Pick<Employee, "id" | "first_name" | "last_name"> | null}>;
};
export const statuses: Record<string,string> = {
  scheduled: "Programado",
  pending_confirmation: "Por confirmar",
  confirmed: "Confirmado",
  in_progress: "En proceso",
  completed: "Terminado",
  cancelled: "Cancelado",
};
export function fullName(person: {first_name: string; last_name?: string | null}) {
  return [person.first_name, person.last_name].filter(Boolean).join(" ");
}
export function money(value: number | null | undefined) {
  return value === null || value === undefined ? "Sin precio" :
    new Intl.NumberFormat("en-US",{style:"currency", currency:"USD"}).format(Number(value));
}
export function localDate(date = new Date()) {
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,"0");
  const d = String(date.getDate()).padStart(2,"0");
  return [y,m,d].join("-");
}
export function displayDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-US",{day:"numeric",month:"short",year:"numeric"})
    .format(new Date(year,month-1,day));
}
export function timeLabel(value: string | null | undefined) {
  return value?.slice(0,5) || "Sin hora";
}
export function addDays(date: Date, offset: number) {
  const copy = new Date(date.getFullYear(),date.getMonth(),date.getDate());
  copy.setDate(copy.getDate()+offset);
  return copy;
}
export function monday(date: Date) {
  return addDays(date, -((date.getDay()+6)%7));
}


export type JobPayment = {
  id: string;
  job_id: string;
  amount: number;
  method: "cash" | "check" | "venmo" | "other";
  received_on: string;
  reference: string | null;
  notes: string | null;
  voided_at: string | null;
  void_reason: string | null;
  cleared_on: string | null;
  created_at: string;
};
export const paymentMethods: Record<JobPayment["method"], string> = {
  cash: "Efectivo",
  check: "Cheque",
  venmo: "Venmo",
  other: "Otro"
};
export type TimeEntry = {
  id: string;
  employee_id: string;
  job_id: string | null;
  started_at: string;
  ended_at: string | null;
  break_minutes: number;
  notes: string | null;
  voided_at: string | null;
  void_reason: string | null;
  correction_reason: string | null;
  source: "admin_manual" | "admin_clock";
};
export function hoursWorked(entry: Pick<TimeEntry, "started_at" | "ended_at" | "break_minutes">) {
  if (!entry.ended_at) return null;
  const mins = (new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / 60000
    - entry.break_minutes;
  return Math.max(0, Math.round((mins / 60) * 100) / 100);
}
export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
