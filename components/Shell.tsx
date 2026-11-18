"use client";
import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import {useEffect} from "react";
import type {ReactNode} from "react";
import {useAuth} from "@/components/AuthProvider";
const nav=[
  {href:"/",label:"Inicio",icon:"🏠"},
  {href:"/calendar",label:"Calendario",icon:"📅"},
  {href:"/jobs",label:"Trabajos",icon:"🧹"},
  {href:"/clients",label:"Clientes",icon:"👥"},
  {href:"/properties",label:"Propiedades",icon:"🏡"},
  {href:"/employees",label:"Empleados",icon:"👷"},
];
export default function Shell({children}:{children:ReactNode}){
  const {user,loading,signOut}=useAuth();
  const pathname=usePathname(),router=useRouter();
  const login=pathname==="/login";
  useEffect(()=>{if(!login&&!loading&&!user)router.replace("/login");},[login,loading,user,router]);
  if(login)return <>{children}</>;
  if(loading||!user)return <main className="min-h-screen grid place-items-center text-slate-600">Verificando acceso…</main>;
  return <div className="min-h-screen lg:flex">
    <aside className="border-b border-slate-200 bg-white lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="px-5 py-5">
        <div className="text-lg font-bold text-slate-900">Cleaning Manager</div>
        <div className="text-xs text-slate-500">Administración privada</div>
      </div>
      <nav aria-label="Menú principal" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col">
        {nav.map(n=><Link key={n.href} href={n.href}
          className={"shrink-0 rounded-lg px-3 py-3 text-sm font-medium transition "+(pathname===n.href?"bg-slate-900 text-white":"text-slate-700 hover:bg-slate-100")}>
          <span aria-hidden="true" className="mr-2">{n.icon}</span>{n.label}
        </Link>)}
      </nav>
      <div className="px-5 pb-4 lg:mt-8">
        <p className="mb-2 max-w-full truncate text-xs text-slate-500">{user.email}</p>
        <button type="button" onClick={()=>void signOut()} className="rounded-lg border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Cerrar sesión</button>
      </div>
    </aside>
    <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
  </div>;
}
