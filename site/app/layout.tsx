import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "MMP Rate Watch", description: "Your private Marriott Explore rate dashboard." };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>;}
