"use client";
import {FormEvent,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {useAuth} from "@/components/AuthProvider";
export default function LoginPage(){
  const router=useRouter();
  const {user,loading,signIn}=useAuth();
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{if(!loading&&user)router.replace("/");},[user,loading,router]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");
    const failure=await signIn(email,password);
    setBusy(false);
    if(failure)setError(failure);else router.replace("/");
  }
  return <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
    <form onSubmit={submit} className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
      <div className="mb-2 text-2xl font-bold">Cleaning Manager</div>
      <p className="mb-7 text-slate-600">Acceso exclusivo para los dueños y el administrador.</p>
      <label className="mb-2 block text-sm font-medium" htmlFor="email">Correo electrónico</label>
      <input id="email" required autoComplete="username" type="email" className="field mb-5"
        value={email} onChange={e=>setEmail(e.target.value)}/>
      <label className="mb-2 block text-sm font-medium" htmlFor="password">Contraseña</label>
      <input id="password" required autoComplete="current-password" type="password" className="field mb-5"
        value={password} onChange={e=>setPassword(e.target.value)}/>
      {error&&<p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
      <button disabled={busy||loading} className="btn-primary w-full" type="submit">{busy?"Entrando…":"Iniciar sesión"}</button>
      <p className="mt-5 text-xs text-slate-500">Las cuentas se crean por invitación. No hay registro público.</p>
    </form>
  </main>;
}
