import type { PassengerNoticesResult } from "@/application/announcements/list-passenger-notices";

interface ServiceAnnouncementsProps {
  notices: PassengerNoticesResult;
}

export function ServiceAnnouncements({ notices }: ServiceAnnouncementsProps) {
  if (notices.suspensions.length === 0 && notices.announcements.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="service-announcements-heading" className="space-y-2.5">
      <h2 id="service-announcements-heading" className="font-heading text-ink text-base font-bold">
        Avisos del servicio
      </h2>

      {notices.suspensions.map((suspension) => (
        <article
          key={suspension.id}
          role="alert"
          className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-950 shadow-xs"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
              Servicio suspendido
            </span>
            <span className="text-xs font-bold">Muelle {suspension.dockName}</span>
          </div>
          <p className="mt-1.5 text-sm font-medium">{suspension.reason}</p>
          {suspension.untilLabel ? (
            <p className="mt-1 text-xs text-red-800">Hasta: {suspension.untilLabel}</p>
          ) : null}
        </article>
      ))}

      {notices.announcements.map((announcement) => (
        <article
          key={announcement.id}
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-md bg-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-950">
              {announcement.scopeLabel}
            </span>
            {announcement.validUntilLabel ? (
              <span className="text-[11px] font-medium text-amber-900">
                Vigente hasta: {announcement.validUntilLabel}
              </span>
            ) : null}
          </div>
          <p className="font-heading mt-1.5 text-sm font-bold">{announcement.title}</p>
          <p className="mt-1 text-xs leading-relaxed">{announcement.message}</p>
        </article>
      ))}
    </section>
  );
}
