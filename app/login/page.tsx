"use client";

import {FormEvent,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {useAuth} from "@/components/AuthProvider";

export default function LoginPage(){
  const router=useRouter();
  const {user,loading,mfaRequired,hasVerifiedFactor,signIn,enrollMfa,verifyMfa,signOut}=useAuth();
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [code,setCode]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [enrollment,setEnrollment]=useState<{qr:string;secret:string}|null>(null);

  useEffect(()=>{if(!loading&&user)router.replace("/");},[user,loading,router]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");
    const failure=await signIn(email,password);
    setBusy(false);
    if(failure)setError(failure);
    else if(!mfaRequired)router.refresh();
  }
  async function startEnrollment(){
    setBusy(true);setError("");
    const result=await enrollMfa();
    setBusy(false);
    if(result.error)setError(result.error);
    else if(result.data)setEnrollment(result.data);
  }
  async function submitMfa(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");
    const failure=await verifyMfa(code);
    setBusy(false);
    if(failure)setError(failure);else router.replace("/");
  }
  return <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
    <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
      <h1 className="mb-2 text-2xl font-bold">Cleaning Manager</h1>
      <p className="mb-7 text-slate-600">Panel privado de propietarios y administrador.</p>
      {!mfaRequired? <form onSubmit={submit}>
        <label className="mb-2 block text-sm font-medium" htmlFor="email">Correo electrónico</label>
        <input id="email" required autoComplete="username" type="email" className="field mb-5"
          value={email} onChange={e=>setEmail(e.target.value)}/>
        <label className="mb-2 block text-sm font-medium" htmlFor="password">Contraseña</label>
        <input id="password" required autoComplete="current-password" type="password" className="field mb-5"
          value={password} onChange={e=>setPassword(e.target.value)}/>
        {error&&<p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
        <button disabled={busy||loading} className="btn-primary w-full" type="submit">
          {busy?"Verificando…":"Iniciar sesión"}
        </button>
      </form>:<div className="space-y-4">
        <h2 className="text-xl font-semibold">Verificación en dos pasos</h2>
        {(!hasVerifiedFactor&&!enrollment)&&<>
          <p className="text-sm text-slate-600">Solo la primera vez: configura una aplicación de autenticación en tu teléfono (por ejemplo, Microsoft Authenticator o Google Authenticator).</p>
          <button type="button" className="btn-primary w-full" disabled={busy} onClick={()=>void startEnrollment()}>
            {busy?"Configurando…":"Configurar segundo factor"}
          </button>
        </>}
        {enrollment&&<>
          <p className="text-sm text-slate-600">Escanea este QR con tu aplicación de autenticación. No compartas la imagen ni la clave.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrollment.qr} alt="Código QR para configurar autenticación de dos pasos" className="mx-auto max-h-56 max-w-full"/>
          <p className="break-all rounded-lg bg-slate-50 p-2 text-xs">Clave manual (privada): {enrollment.secret}</p>
        </>}
        {(hasVerifiedFactor||enrollment)&&<form onSubmit={submitMfa} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="mfa-code">Código de 6 dígitos
            <input id="mfa-code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}"
              maxLength={6} required className="field mt-2" value={code}
              onChange={e=>setCode(e.target.value.replace(/\D/g,""))}/>
          </label>
          <button className="btn-primary w-full" disabled={busy} type="submit">
            {busy?"Verificando…":"Verificar y continuar"}
          </button>
        </form>}
        {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="button" className="btn-outline w-full" onClick={()=>void signOut()}>Cancelar y cerrar sesión</button>
        <p className="text-xs text-slate-500">Si perdiste el teléfono de autenticación, contacta al administrador técnico por otro medio. No existe recuperación automática mediante esta página.</p>
      </div>}
      <p className="mt-6 text-xs text-slate-500">Las cuentas se crean por invitación. No hay registro público.</p>
    </div>
  </main>;
}
