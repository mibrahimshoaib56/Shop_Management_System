import { Player } from "@lottiefiles/react-lottie-player"

import loaderAnimation from "@/assets/loading.json"

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10">
      <Player
        autoplay
        loop
        src={loaderAnimation as object}
        style={{ width: 250, height: 250 }}
      />
      {label ? <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span> : null}
    </div>
  )
}

