import { supabase } from "@/lib/supabase";
import type {Client, Property, Employee, Job, JobPayment, TimeEntry} from "@/lib/types";

export async function getClients(): Promise<Client[]> {
  const {data,error} = await supabase.from("clients").select("*").order("first_name");
  if (error) throw error;
  return (data || []) as Client[];
}
export async function getProperties(): Promise<Property[]> {
  const {data,error} = await supabase.from("properties")
    .select("*, clients(first_name,last_name)").order("property_name");
  if (error) throw error;
  return (data || []) as unknown as Property[];
}
export async function getEmployees(): Promise<Employee[]> {
  const {data,error} = await supabase.from("employees").select("*").order("first_name");
  if (error) throw error;
  return (data || []) as Employee[];
}
export async function getJobs(): Promise<Job[]> {
  const {data,error} = await supabase.from("jobs")
    .select("*, properties(id,property_name,address_line1,city,client_id,clients(first_name,last_name)), job_assignments(employee_id,employees(id,first_name,last_name))")
    .order("job_date",{ascending:true})
    .order("start_time",{ascending:true});
  if (error) throw error;
  return (data || []) as unknown as Job[];
}
export function message(error: unknown): string {
  return error instanceof Error ? error.message :
    (error && typeof error === "object" && "message" in error ? String(error.message) : "Ocurrió un error");
}

export async function getPayments(): Promise<JobPayment[]> {
  const {data,error} = await supabase.from("job_payments").select("*")
    .order("received_on",{ascending:false}).order("created_at",{ascending:false}).limit(500);
  if (error) throw error;
  return (data || []) as JobPayment[];
}
export async function getTimeEntries(): Promise<TimeEntry[]> {
  const {data,error} = await supabase.from("time_entries").select("*")
    .order("started_at",{ascending:false}).limit(500);
  if (error) throw error;
  return (data || []) as TimeEntry[];
}
