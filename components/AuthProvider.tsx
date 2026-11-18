"use client";

import {createContext,useCallback,useContext,useEffect,useRef,useState} from "react";
import type {ReactNode} from "react";
import type {User} from "@supabase/supabase-js";
import {supabase} from "@/lib/supabase";

type Enrollment = {qr:string;secret:string};
type AuthValue = {
  user:User|null;
  loading:boolean;
  mfaRequired:boolean;
  hasVerifiedFactor:boolean;
  signIn:(email:string,password:string)=>Promise<string|null>;
  enrollMfa:()=>Promise<{data?:Enrollment;error?:string}>;
  verifyMfa:(code:string)=>Promise<string|null>;
  signOut:()=>Promise<void>;
};
const Context=createContext<AuthValue|null>(null);
export function useAuth(){
  const ctx=useContext(Context);
  if(!ctx)throw new Error("Auth provider missing");
  return ctx;
}
export default function AuthProvider({children}:{children:ReactNode}){
  const [user,setUser]=useState<User|null>(null);
  const [loading,setLoading]=useState(true);
  const [mfaRequired,setMfaRequired]=useState(false);
  const [hasVerifiedFactor,setHasVerifiedFactor]=useState(false);
  const enrollingFactor=useRef<string|null>(null);

  const validateSession=useCallback(async(current:User|null)=>{
    if(!current){setUser(null);setMfaRequired(false);setHasVerifiedFactor(false);return;}
    const {data:member,error:memberError}=await supabase.from("admin_users")
      .select("role").eq("user_id",current.id).maybeSingle();
    if(memberError||!member){
      await supabase.auth.signOut();
      setUser(null);setMfaRequired(false);setHasVerifiedFactor(false);
      return;
    }
    const {data:level,error:levelError}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if(levelError)throw levelError;
    if(level.currentLevel==="aal2"){
      setUser(current);setMfaRequired(false);setHasVerifiedFactor(true);
      return;
    }
    const {data:factors,error:factorError}=await supabase.auth.mfa.listFactors();
    if(factorError)throw factorError;
    setUser(null);setMfaRequired(true);
    setHasVerifiedFactor((factors.totp||[]).length>0);
  },[]);

  useEffect(()=>{
    let active=true;
    const init=async()=>{
      try{
        const {data:{user:current},error}=await supabase.auth.getUser();
        if(error)throw error;
        if(active)await validateSession(current);
      }catch{
        if(active){setUser(null);setMfaRequired(false);}
      }finally{if(active)setLoading(false);}
    };
    void init();
    const {data:{subscription}}=supabase.auth.onAuthStateChange(event=>{
      if(event==="SIGNED_OUT"&&active){
        setUser(null);setMfaRequired(false);setHasVerifiedFactor(false);
        enrollingFactor.current=null;setLoading(false);
      }
    });
    return ()=>{active=false;subscription.unsubscribe();};
  },[validateSession]);

  const signIn=async(email:string,password:string)=>{
    const {data,error}=await supabase.auth.signInWithPassword({email,password});
    if(error)return "No se pudo iniciar sesión. Revisa el correo y la contraseña.";
    try{
      await validateSession(data.user);
      return null;
    }catch{
      await supabase.auth.signOut();
      return "No se pudo verificar la seguridad de esta cuenta.";
    }
  };

  const enrollMfa=async()=>{
    const {data:member,error:authError}=await supabase.from("admin_users")
      .select("user_id").maybeSingle();
    if(authError||!member)return {error:"La cuenta no está autorizada."};
    const {data,error}=await supabase.auth.mfa.enroll({
      factorType:"totp",friendlyName:"Cleaning Manager"
    });
    if(error||!data||!data.totp)return {error:"No se pudo configurar el segundo factor."};
    enrollingFactor.current=data.id;
    return {data:{qr:data.totp.qr_code,secret:data.totp.secret}};
  };

  const verifyMfa=async(code:string)=>{
    if(!/^\d{6}$/.test(code))return "Introduce los 6 números de tu aplicación de autenticación.";
    let factorId=enrollingFactor.current;
    if(!factorId){
      const {data,error}=await supabase.auth.mfa.listFactors();
      if(error)return "No se pudieron consultar los factores de acceso.";
      factorId=data.totp?.[0]?.id||null;
    }
    if(!factorId)return "Primero configura el segundo factor de acceso.";
    const {error}=await supabase.auth.mfa.challengeAndVerify({factorId,code});
    if(error)return "El código no es válido o ya caducó.";
    enrollingFactor.current=null;
    const {data:{user:current}}=await supabase.auth.getUser();
    try{
      await validateSession(current);
      return null;
    }catch{return "No se pudo completar la validación del acceso.";}
  };

  const signOut=async()=>{
    await supabase.auth.signOut();
    enrollingFactor.current=null;
    setUser(null);setMfaRequired(false);setHasVerifiedFactor(false);
  };
  return <Context.Provider value={{user,loading,mfaRequired,hasVerifiedFactor,signIn,enrollMfa,verifyMfa,signOut}}>
    {children}
  </Context.Provider>;
}
