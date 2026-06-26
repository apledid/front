"use client"

export function LandingBackground() {
  return (
    <div className="pointer-events-none fixed inset-0">
      <div className="absolute -left-32 top-1/4 h-[400px] w-[400px] rounded-full bg-[#e87fa0]/8 blur-[120px] animate-pulse-slow" />
      <div className="absolute -right-32 bottom-1/4 h-[400px] w-[400px] rounded-full bg-[#e87fa0]/8 blur-[120px] animate-pulse-slow" style={{ animationDelay: "3s" }} />
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
    </div>
  )
}
