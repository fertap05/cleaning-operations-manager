"use client";

import {createContext,useContext,useEffect,useState} from "react";
import type {ReactNode} from "react";
import type {User} from "@supabase/supabase-js";
import {supabase} from "@/lib/supabase";

type AuthValue = {
  user: User | null; loading: boolean;
  signIn: (email:string,password:string)=>Promise<string | null>;
  signOut: ()=>Promise<void>;
};
const Context = createContext<AuthValue | null>(null);
export function useAuth() {
  const ctx=useContext(Context);
  if(!ctx) throw new Error("Auth provider missing");
  return ctx;
}
export default function AuthProvider({children}:{children:ReactNode}) {
  const [user,setUser]=useState<User|null>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let alive=true;
    const check=async()=>{
      try{
        const {data:{user:current}}=await supabase.auth.getUser();
        if (!current) {if(alive)setUser(null);return;}
        const {data:member}=await supabase.from("admin_users").select("role")
          .eq("user_id",current.id).maybeSingle();
        if (!member) {
          await supabase.auth.signOut();
          if(alive)setUser(null);
        } else if(alive) setUser(current);
      }catch {if(alive)setUser(null);}
      finally {if(alive)setLoading(false);}
    };
    void check();
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{
      if(event==="SIGNED_OUT" && alive) {setUser(null);setLoading(false);}
    });
    return ()=>{alive=false;subscription.unsubscribe();};
  },[]);
  const signIn=async(email:string,password:string)=>{
    const {data,error}=await supabase.auth.signInWithPassword({email,password});
    if(error) return "No se pudo iniciar sesión. Revisa el correo y la contraseña.";
    const {data:member,error:memberError}=await supabase.from("admin_users")
      .select("role").eq("user_id",data.user.id).maybeSingle();
    if(memberError || !member){
      await supabase.auth.signOut();
      return "Esta cuenta no tiene permiso para acceder al panel.";
    }
    setUser(data.user);
    setLoading(false);
    return null;
  };
  const signOut=async()=>{await supabase.auth.signOut();setUser(null);};
  return <Context.Provider value={{user,loading,signIn,signOut}}>{children}</Context.Provider>;
}
