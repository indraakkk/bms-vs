"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/** Bottom-center inverted pill per the design mock — no per-type icons,
 *  errors switch to the critical color via globals.css. */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      toastOptions={{
        className: "justify-center font-bold",
        style: {
          width: "fit-content",
          marginInline: "auto",
          padding: "11px 20px",
          fontSize: "13px",
        },
      }}
      style={
        {
          "--normal-bg": "var(--foreground)",
          "--normal-text": "var(--background)",
          "--normal-border": "transparent",
          "--border-radius": "11px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
