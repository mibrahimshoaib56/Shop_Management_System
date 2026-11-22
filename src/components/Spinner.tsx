import { Lottie } from "lottie-react"

import loaderAnimation from "@/assets/loading.json"

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10">
      <Lottie
        animationData={loaderAnimation}
        loop={true}
        style={{ width: 80, height: 80 }}
      />
      {label ? <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span> : null}
    </div>
  )
}
