import { clearLocalReminders } from '@/lib/retention'
import { createContext, createElement, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'

function useAuthState() {
  const [session,setSession]=useState<Session|null>(null)
  const [loading,setLoading]=useState(true)
  const [recovery,setRecovery]=useState(false)
  const [error,setError]=useState('')
  useEffect(()=>{
    let alive=true
    let accountId: string | undefined
    const recoveryRequest=new URLSearchParams(location.search).has('recovery')
    supabase.auth.getSession().then(({data,error})=>{if(alive){setSession(data.session);setRecovery(recoveryRequest&&!!data.session);setError(error?.message||'');setLoading(false)}})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,next)=>{
      if(accountId!==next?.user.id){queryClient.clear();clearLocalReminders()}
      accountId=next?.user.id
      setSession(next);setLoading(false)
      if(event==='PASSWORD_RECOVERY')setRecovery(true)
      if(event==='SIGNED_OUT'){setRecovery(false);localStorage.removeItem('cadens-analytics-buffer')}
    })
    return ()=>{alive=false;subscription.unsubscribe();clearLocalReminders()}
  },[])
  return {
    user:session?.user??null,session,loading,recovery,error,
    signIn:(email:string,password:string)=>supabase.auth.signInWithPassword({email,password}),
    signUp:(email:string,password:string)=>supabase.auth.signUp({email,password,options:{emailRedirectTo:location.origin}}),
    signInGoogle:()=>supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin}}),
    resetPassword:(email:string)=>supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/?recovery=1'}),
    updatePassword:async(password:string)=>{
      const result=await supabase.auth.updateUser({password})
      if(!result.error){setRecovery(false);history.replaceState(null,'',location.pathname)}
      return result
    },
    signOut:async()=>{const {error}=await supabase.auth.signOut();if(error)throw error},
  }
}
const AuthContext=createContext<ReturnType<typeof useAuthState>|null>(null)
export function AuthProvider({children}:{children:ReactNode}){return createElement(AuthContext.Provider,{value:useAuthState()},children)}
export function useAuth(){const state=useContext(AuthContext);if(!state)throw Error('AuthProvider missing');return state}
