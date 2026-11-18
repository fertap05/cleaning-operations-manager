import type {Metadata} from "next";
import AuthProvider from "@/components/AuthProvider";
import Shell from "@/components/Shell";
import "./globals.css";
export const metadata:Metadata={
  title:"Cleaning Manager | Administración",
  description:"Sistema privado de operación para una empresa de limpieza"
};
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="es"><body>
    <AuthProvider><Shell>{children}</Shell></AuthProvider>
  </body></html>;
}
