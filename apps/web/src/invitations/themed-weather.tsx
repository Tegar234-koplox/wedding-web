import type {
  InvitationEnvelope,
  PackageCode,
} from "@wedding/invitation-themes";
import { Droplets, Wind } from "lucide-react";
import Script from "next/script";
import React from "react";

import type { ThemeVisual } from "@/invitations/presentation";
import type { InvitationWeather } from "@/lib/api/contracts";

type ThemedWeatherProps = {
  invitation: InvitationEnvelope;
  packageCode: PackageCode;
  design: ThemeVisual;
  weather?: InvitationWeather | null;
};

type WeatherSlot = NonNullable<InvitationWeather["selections"]>[number];

function meteoconsSlugForCode(code: number) {
  if (code === 0) {
    return "clear-day";
  }
  if (code === 1 || code === 2) {
    return "partly-cloudy-day";
  }
  if (code === 3) {
    return "overcast-day";
  }
  if (code === 45 || code === 48) {
    return "fog-day";
  }
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return "rain";
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return "snow";
  }
  if ([95, 96, 99].includes(code)) {
    return "thunderstorms-day-rain";
  }
  return "partly-cloudy-day";
}

function MeteoconsWeatherIcon({
  alt,
  packageCode,
  weatherCode,
  sizeClass,
}: {
  alt: string;
  packageCode: PackageCode;
  weatherCode: number;
  sizeClass: string;
}) {
  const slug = meteoconsSlugForCode(weatherCode);
  if (packageCode === "couture") {
    return React.createElement("lottie-player", {
      "aria-label": alt,
      autoplay: true,
      background: "transparent",
      className: sizeClass,
      loop: true,
      speed: "1",
      src: `https://cdn.meteocons.com/latest/lottie/fill/${slug}.json`,
    } as Record<string, unknown>);
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Meteocons static SVG paths are dynamic CDN assets.
    <img
      alt={alt}
      className={sizeClass}
      height={72}
      loading="lazy"
      src={`https://cdn.meteocons.com/latest/svg-static/fill/${slug}.svg`}
      width={72}
    />
  );
}

function eventLabel(eventType: string | undefined, id: boolean) {
  if (eventType === "ceremony") {
    return id ? "Akad" : "Ceremony";
  }
  if (eventType === "reception") {
    return id ? "Resepsi" : "Reception";
  }
  return id ? "Acara" : "Event";
}

function formatEventTime(value: string, timezone: string, id: boolean) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(id ? "id-ID" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone || undefined,
  }).format(date);
}

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
  const slots: WeatherSlot[] =
    weather?.selections?.length
      ? weather.selections
      : weather?.selected && weather.event && weather.location
        ? [
            {
              event: weather.event,
              location: weather.location,
              selected: weather.selected,
              forecast: weather.forecast,
            },
          ]
        : [];
  const available =
    (weather?.status === "ready" || weather?.status === "stale") &&
    slots.length > 0;
  const rich = packageCode === "couture";
  const primarySlot = slots[0];

  return (
    <section className="px-5 py-24 md:px-12 md:py-36">
      {packageCode === "couture" ? (
        <Script
          src="https://unpkg.com/@lottiefiles/lottie-player@2.0.12/dist/lottie-player.js"
          strategy="afterInteractive"
        />
      ) : null}
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
                  ? slots.length > 1
                    ? id
                      ? "Akad & Resepsi"
                      : "Ceremony & Reception"
                    : primarySlot?.selected.description[invitation.locale]
                : id
                  ? "Tersedia mendekati hari acara"
                  : "Available closer to the event"}
            </h2>
          </div>
            {available && primarySlot ? (
              <MeteoconsWeatherIcon
                alt={primarySlot.selected.description[invitation.locale]}
                packageCode={packageCode}
                sizeClass={`h-16 w-16 ${rich ? "md:h-20 md:w-20" : "md:h-16 md:w-16"}`}
                weatherCode={primarySlot.selected.weather_code}
              />
            ) : (
              <MeteoconsWeatherIcon
                alt={id ? "Prakiraan cuaca" : "Weather forecast"}
                packageCode={packageCode}
                sizeClass={`h-16 w-16 ${rich ? "md:h-20 md:w-20" : "md:h-16 md:w-16"}`}
                weatherCode={2}
              />
            )}
          </div>

          {available ? (
            <div
              className={`mt-12 grid gap-4 ${slots.length > 1 ? "md:grid-cols-2" : ""}`}
            >
              {slots.map((slot) => (
                <div
                  className="border border-current/15 bg-current/[0.035] p-5"
                  key={`${slot.event.event_type ?? "event"}-${slot.event.starts_at}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[0.58rem] uppercase tracking-[0.18em] opacity-50">
                        {eventLabel(slot.event.event_type, id)}
                      </p>
                      <p className="mt-2 text-sm opacity-70">
                        {formatEventTime(
                          slot.event.starts_at,
                          slot.event.timezone,
                          id,
                        )}
                      </p>
                    </div>
                    <MeteoconsWeatherIcon
                      alt={slot.selected.description[invitation.locale]}
                      packageCode={packageCode}
                      sizeClass={`h-12 w-12 ${rich ? "md:h-14 md:w-14" : ""}`}
                      weatherCode={slot.selected.weather_code}
                    />
                  </div>
                  <p className="mt-8 font-serif text-3xl">
                    {slot.selected.description[invitation.locale]}
                  </p>
                  <p className={`mt-3 text-sm ${design.muted}`}>
                    {slot.event.venue}
                  </p>

                  <div className="mt-7 grid gap-px bg-current/15 sm:grid-cols-3">
                    <div className="bg-current/[0.04] p-4">
                      <p className="font-serif text-3xl">
                        {slot.selected.temperature_c}°
                      </p>
                      <p className="mt-3 text-[0.56rem] uppercase tracking-[0.16em] opacity-50">
                        Celsius
                      </p>
                    </div>
                    <div className="bg-current/[0.04] p-4">
                      <Droplets size={17} />
                      <p className="mt-4 text-lg">
                        {slot.selected.humidity_percent}%
                      </p>
                      <p className="mt-2 text-[0.56rem] uppercase tracking-[0.16em] opacity-50">
                        {id ? "Lembap" : "Humidity"}
                      </p>
                    </div>
                    <div className="bg-current/[0.04] p-4">
                      <Wind size={17} />
                      <p className="mt-4 text-lg">
                        {slot.selected.wind.speed_kmh} km/h
                      </p>
                      <p className="mt-2 text-[0.56rem] uppercase tracking-[0.16em] opacity-50">
                        {id ? "Angin" : "Wind"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
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
              href={weather?.attribution_url ?? "https://open-meteo.com/"}
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
