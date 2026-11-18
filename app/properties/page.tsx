"use client";
import Link from "next/link";
import {useCallback,useEffect,useState} from "react";
import {getProperties,message} from "@/lib/data";
import {fullName,money} from "@/lib/types";
import type {Property} from "@/lib/types";
export default function PropertiesPage(){
  const [properties,setProperties]=useState<Property[]>([]);
  const [query,setQuery]=useState("");
  const [error,setError]=useState("");
  const refresh=useCallback(async()=>{try{setProperties(await getProperties());}catch(e){setError(message(e));}},[]);
  useEffect(()=>{void Promise.resolve().then(refresh);},[refresh]);
  const filtered=properties.filter(p=>(p.property_name+" "+p.address_line1+" "+(p.city||"")+" "+(p.clients?fullName(p.clients):""))
    .toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <div className="mx-auto max-w-6xl space-y-6">
    <header><h1 className="page-title">Propiedades</h1><p className="hint">Todas las casas, iglesias, oficinas y alquileres.</p></header>
    <input aria-label="Buscar propiedades" className="field" placeholder="Buscar por nombre, dirección o cliente…" value={query} onChange={e=>setQuery(e.target.value)}/>
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    <div className="grid gap-4 md:grid-cols-2">
      {filtered.map(p=><article className="panel" key={p.id}>
        <h2 className="text-lg font-semibold">{p.property_name}</h2>
        <p className="hint">{p.address_line1}{p.city?", "+p.city:""}</p>
        <p className="mt-2 text-sm">Cliente: {p.clients?fullName(p.clients):"Sin cliente"}</p>
        <p className="mt-1 text-sm">Precio habitual: {money(p.usual_price)}</p>
        <div className="mt-4"><Link className="btn-outline text-sm" href={"/clients/"+p.client_id}>Abrir ficha de propiedad</Link></div>
      </article>)}
      {!filtered.length&&<p className="hint">No hay propiedades para esta búsqueda.</p>}
    </div>
  </div>;
}
