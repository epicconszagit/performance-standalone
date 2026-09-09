const LOGO_URL = "https://media.base44.com/images/public/6a5df9c009518866564e2bed/28390cb4e_image.png";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full overflow-hidden bg-white shadow-md ring-2 ring-amber-400/50 mb-3 mx-auto">
            <img src={LOGO_URL} alt="EPIC TASK PERFORMANCE TRACKING SYSTEM" className="w-full h-full object-contain" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600 mb-1">
            EPIC TASK PERFORMANCE TRACKING SYSTEM
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-heading">{title}</h1>
          {subtitle && <p className="text-slate-500 text-sm mt-1.5">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}
