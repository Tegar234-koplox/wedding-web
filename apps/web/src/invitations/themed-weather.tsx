import type {
  InvitationEnvelope,
  PackageCode,
} from "@wedding/invitation-themes";
import { CloudRain, CloudSun, Droplets, Wind } from "lucide-react";
import React from "react";

import type { ThemeVisual } from "@/invitations/presentation";
import type { InvitationWeather } from "@/lib/api/contracts";

type ThemedWeatherProps = {
  invitation: InvitationEnvelope;
  packageCode: PackageCode;
  design: ThemeVisual;
  weather?: InvitationWeather | null;
};

export function ThemedWeather({
  invitation,
  packageCode,
  design,
  weather,
}: ThemedWeatherProps) {
  if (packageCode === "essential") {
    return null;
  }

  const id = invitation.locale === "id";
  const selected = weather?.selected;
  const available =
    (weather?.status === "ready" || weather?.status === "stale") && selected;
  const rich = packageCode === "couture";

  return (
    <section className="px-5 py-24 md:px-12 md:py-36">
      <div
        className={`relative mx-auto max-w-5xl overflow-hidden border p-7 md:p-12 ${design.weather} ${design.glow}`}
      >
        <div className={`absolute inset-0 ${design.overlay} opacity-35`} />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-[0.62rem] uppercase tracking-[0.24em] opacity-55">
                {id
                  ? "Prakiraan Cuaca Lokasi Acara"
                  : "Event Location Weather Forecast"}
              </p>
              <h2 className="mt-4 font-serif text-4xl md:text-6xl">
                {available
                  ? selected.description[invitation.locale]
                  : id
                    ? "Tersedia mendekati hari acara"
                    : "Available closer to the event"}
              </h2>
            </div>
            {available && selected.precipitation_mm > 0.4 ? (
              <CloudRain className={design.accent} size={rich ? 48 : 38} />
            ) : (
              <CloudSun className={design.accent} size={rich ? 48 : 38} />
            )}
          </div>

          {available ? (
            <div className="mt-12 grid gap-px bg-current/15 sm:grid-cols-3">
              <div className="bg-current/[0.04] p-5">
                <p className="font-serif text-4xl">{selected.temperature_c}°</p>
                <p className="mt-3 text-[0.58rem] uppercase tracking-[0.18em] opacity-50">
                  Celsius
                </p>
              </div>
              <div className="bg-current/[0.04] p-5">
                <Droplets size={19} />
                <p className="mt-4 text-xl">{selected.humidity_percent}%</p>
                <p className="mt-2 text-[0.58rem] uppercase tracking-[0.18em] opacity-50">
                  {id ? "Kelembapan" : "Humidity"}
                </p>
              </div>
              <div className="bg-current/[0.04] p-5">
                <Wind size={19} />
                <p className="mt-4 text-xl">{selected.wind.speed_kmh} km/h</p>
                <p className="mt-2 text-[0.58rem] uppercase tracking-[0.18em] opacity-50">
                  {id ? "Angin" : "Wind"}
                </p>
              </div>
            </div>
          ) : (
            <p className={`mt-8 max-w-2xl text-sm leading-7 ${design.muted}`}>
              {weather?.reason === "provider_unavailable"
                ? id
                  ? "Layanan Open-Meteo sedang tidak tersedia. Informasi akan diperbarui kembali tanpa mengganggu undangan."
                  : "Open-Meteo is temporarily unavailable. The invitation will remain available while weather refreshes."
                : id
                  ? "Prakiraan akan muncul ketika acara memasuki jangkauan prakiraan 16 hari. Preview ini tidak menampilkan data cuaca buatan."
                  : "The forecast appears when the event enters Open-Meteo's 16-day forecast window. This preview never invents weather data."}
            </p>
          )}

          <div className="mt-9 flex flex-wrap justify-between gap-4 border-t border-current/15 pt-5 text-[0.58rem] uppercase tracking-[0.17em] opacity-55">
            <a
              className="underline underline-offset-4"
              href={
                weather?.attribution_url ??
                "https://open-meteo.com/"
              }
              rel="noopener noreferrer"
              target="_blank"
            >
              {id ? "Bersumber dari Open-Meteo" : "Source: Open-Meteo"}
            </a>
            <span>
              {weather?.updated_at
                ? `${id ? "Diperbarui pada" : "Updated"} ${new Intl.DateTimeFormat(
                    id ? "id-ID" : "en-US",
                    { dateStyle: "medium", timeStyle: "short" },
                  ).format(new Date(weather.updated_at))}`
                : id
                  ? "Menunggu jangkauan prakiraan"
                  : "Awaiting forecast window"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
