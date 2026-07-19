"use client";

import {
  bespokeConfigSchema,
  bespokeSectionTypes,
  bespokeVariantIds,
  defaultBespokeConfig,
  type BespokeConfig,
  type BespokeSectionType,
} from "@wedding/invitation-themes";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { staffFetch } from "./staff-api";

type ScopeAgreement = {
  id: string;
  version: number;
  status: string;
  scope: Record<string, unknown>;
  total_amount: string;
  revision_limit: number;
  production_days_min: number;
  production_days_max: number;
};

const control =
  "min-h-11 w-full border border-white/15 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#d9b55a]";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 border border-[#d9b55a]/60 px-4 text-xs font-semibold uppercase tracking-[.14em] text-[#e6c873] disabled:opacity-40";

function newSection(
  type: BespokeSectionType,
  sections: BespokeConfig["sections"],
) {
  let suffix = 1;
  while (sections.some((section) => section.id === `${type}-${suffix}`))
    suffix += 1;
  return {
    id: `${type}-${suffix}`,
    type,
    variant: bespokeVariantIds[type][0],
    enabled: true,
  };
}

export function BespokeWorkspace({
  orderStatus,
  previewUrl,
  reference,
}: {
  orderStatus: string;
  previewUrl: string;
  reference: string;
}) {
  const [config, setConfig] = useState<BespokeConfig>(
    structuredClone(defaultBespokeConfig),
  );
  const [scopes, setScopes] = useState<ScopeAgreement[]>([]);
  const [scopeSummary, setScopeSummary] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [totalAmount, setTotalAmount] = useState("849000");
  const [changeDescription, setChangeDescription] = useState("");
  const [changePriceDelta, setChangePriceDelta] = useState("0");
  const [changeScheduleDelta, setChangeScheduleDelta] = useState("0");
  const [newType, setNewType] = useState<BespokeSectionType>("timeline");
  const [previewWidth, setPreviewWidth] = useState("100%");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [configResponse, scopeResponse] = await Promise.all([
      staffFetch<{ config: BespokeConfig }>(
        `/admin/orders/${reference}/bespoke-config`,
      ),
      staffFetch<ScopeAgreement[]>(`/admin/orders/${reference}/bespoke-scopes`),
    ]);
    setConfig(bespokeConfigSchema.parse(configResponse.config));
    setScopes(scopeResponse);
  }, [reference]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((error) =>
        setMessage(
          error instanceof Error ? error.message : "Bespoke gagal dimuat.",
        ),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function patchTokens(field: keyof BespokeConfig["tokens"], value: string) {
    setConfig((current) => ({
      ...current,
      tokens: { ...current.tokens, [field]: value } as BespokeConfig["tokens"],
    }));
  }

  function patchSection(
    index: number,
    patch: Partial<BespokeConfig["sections"][number]>,
  ) {
    setConfig((current) => ({
      ...current,
      sections: current.sections.map((section, itemIndex) =>
        itemIndex === index ? { ...section, ...patch } : section,
      ),
    }));
  }

  function moveSection(index: number, delta: number) {
    setConfig((current) => {
      const sections = [...current.sections];
      const target = index + delta;
      if (target < 0 || target >= sections.length) return current;
      const sourceSection = sections[index];
      const targetSection = sections[target];
      if (!sourceSection || !targetSection) return current;
      sections[index] = targetSection;
      sections[target] = sourceSection;
      return { ...current, sections };
    });
  }

  async function saveConfig() {
    setBusy(true);
    setMessage("");
    try {
      const parsed = bespokeConfigSchema.parse(config);
      const response = await staffFetch<{ config: BespokeConfig }>(
        `/admin/orders/${reference}/bespoke-config`,
        { method: "PATCH", body: JSON.stringify({ config: parsed }) },
      );
      setConfig(response.config);
      setMessage("Konfigurasi Bespoke tersimpan.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Konfigurasi gagal disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createScope() {
    setBusy(true);
    setMessage("");
    try {
      await staffFetch(`/admin/orders/${reference}/bespoke-scopes`, {
        method: "POST",
        body: JSON.stringify({
          scope: {
            summary: scopeSummary.trim(),
            deliverables: deliverables
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean),
            exclusions: exclusions
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean),
            commercial_rule:
              "Out-of-scope requests require an approved paid change request.",
          },
          total_amount: totalAmount,
          revision_limit: 8,
          production_days_min: 10,
          production_days_max: 14,
        }),
      });
      await load();
      setMessage("Scope versi baru dibuat.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Scope gagal dibuat.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createChangeRequest() {
    setBusy(true);
    setMessage("");
    try {
      await staffFetch(`/admin/orders/${reference}/bespoke-change-requests`, {
        method: "POST",
        body: JSON.stringify({
          description: changeDescription.trim(),
          price_delta: changePriceDelta,
          schedule_delta_days: changeScheduleDelta,
          scope: {
            summary: scopeSummary.trim(),
            deliverables: deliverables
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean),
            exclusions: exclusions
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean),
            commercial_rule: "Approved paid change request after publication.",
          },
        }),
      });
      await load();
      setMessage(
        "Change request dan scope versi baru dibuat. Kirim scope itu untuk persetujuan klien.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Change request gagal dibuat.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createReview(purpose: "scope" | "final", scopeId?: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await staffFetch<{ review_path: string }>(
        `/admin/orders/${reference}/bespoke-reviews`,
        {
          method: "POST",
          body: JSON.stringify({ purpose, scope_id: scopeId }),
        },
      );
      const url = `${window.location.origin}${response.review_path}`;
      await navigator.clipboard.writeText(url);
      setMessage(
        `Link review ${purpose === "scope" ? "scope" : "final"} dibuat dan disalin.`,
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Link review gagal dibuat.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-[#d9b55a]/35 bg-[#12110e] p-5 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[.68rem] font-semibold uppercase tracking-[.28em] text-[#d9b55a]">
            Bespoke Engine v1
          </p>
          <h2 className="mt-2 font-serif text-3xl text-white">
            Studio konfigurasi terstruktur
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
            Satu renderer bersama, variasi visual disimpan sebagai data
            berversi. Tidak ada kode renderer baru per customer.
          </p>
        </div>
        <button
          className={button}
          disabled={busy}
          onClick={() => void saveConfig()}
          type="button"
        >
          <Save size={14} /> Simpan
        </button>
      </div>
      {message ? (
        <p className="mt-4 border border-white/10 px-4 py-3 text-sm text-[#e6c873]">
          {message}
        </p>
      ) : null}

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,.85fr)]">
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                "background",
                "surface",
                "text",
                "muted",
                "accent",
                "border",
              ] as const
            ).map((field) => (
              <label
                className="text-[.68rem] uppercase tracking-[.16em] text-white/50"
                key={field}
              >
                {field}
                <div className="mt-2 flex gap-2">
                  <input
                    className="h-11 w-12 border border-white/15 bg-transparent p-1"
                    onChange={(event) => patchTokens(field, event.target.value)}
                    type="color"
                    value={config.tokens[field]}
                  />
                  <input
                    className={control}
                    onChange={(event) => patchTokens(field, event.target.value)}
                    value={config.tokens[field]}
                  />
                </div>
              </label>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs text-white/55">
              Display font
              <select
                className={`${control} mt-2`}
                onChange={(event) =>
                  patchTokens("displayFont", event.target.value)
                }
                value={config.tokens.displayFont}
              >
                {[
                  "cormorant-garamond",
                  "playfair-display",
                  "bodoni-moda",
                  "lora",
                  "inter",
                  "manrope",
                ].map((font) => (
                  <option className="bg-[#111]" key={font}>
                    {font}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-white/55">
              Body font
              <select
                className={`${control} mt-2`}
                onChange={(event) =>
                  patchTokens("bodyFont", event.target.value)
                }
                value={config.tokens.bodyFont}
              >
                {[
                  "cormorant-garamond",
                  "playfair-display",
                  "bodoni-moda",
                  "lora",
                  "inter",
                  "manrope",
                ].map((font) => (
                  <option className="bg-[#111]" key={font}>
                    {font}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-white/55">
              Design version
              <input
                className={`${control} mt-2`}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    designVersion: event.target.value,
                  }))
                }
                value={config.designVersion}
              />
            </label>
          </div>

          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[.2em] text-[#d9b55a]">
                  Section registry
                </p>
                <p className="mt-1 text-sm text-white/50">
                  Cover, event, dan closing wajib aktif.
                </p>
              </div>
              <div className="flex gap-2">
                <select
                  className={control}
                  onChange={(event) =>
                    setNewType(event.target.value as BespokeSectionType)
                  }
                  value={newType}
                >
                  {bespokeSectionTypes.map((type) => (
                    <option className="bg-[#111]" key={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <button
                  className={button}
                  onClick={() =>
                    setConfig((current) => ({
                      ...current,
                      sections: [
                        ...current.sections,
                        newSection(newType, current.sections),
                      ],
                    }))
                  }
                  type="button"
                >
                  <Plus size={14} /> Tambah
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {config.sections.map((section, index) => (
                <div
                  className="grid gap-3 border border-white/10 p-3 md:grid-cols-[8rem_minmax(0,1fr)_auto]"
                  key={section.id}
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[.14em] text-white">
                      {section.type}
                    </p>
                    <p className="mt-1 text-[.7rem] text-white/40">
                      {section.id}
                    </p>
                  </div>
                  <select
                    className={control}
                    onChange={(event) =>
                      patchSection(index, { variant: event.target.value })
                    }
                    value={section.variant}
                  >
                    {bespokeVariantIds[section.type].map((variant) => (
                      <option className="bg-[#111]" key={variant}>
                        {variant}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <label className="mr-2 text-xs text-white/55">
                      <input
                        checked={section.enabled}
                        className="mr-1"
                        onChange={(event) =>
                          patchSection(index, { enabled: event.target.checked })
                        }
                        type="checkbox"
                      />
                      aktif
                    </label>
                    <button
                      aria-label="Naik"
                      onClick={() => moveSection(index, -1)}
                      type="button"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      aria-label="Turun"
                      onClick={() => moveSection(index, 1)}
                      type="button"
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      aria-label="Hapus"
                      disabled={["cover", "event", "closing"].includes(
                        section.type,
                      )}
                      onClick={() =>
                        setConfig((current) => ({
                          ...current,
                          sections: current.sections.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        }))
                      }
                      type="button"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["Mobile", "390px"],
                ["Tablet", "768px"],
                ["Desktop", "100%"],
              ] as const
            ).map(([label, width]) => (
              <button
                className={button}
                key={label}
                onClick={() => setPreviewWidth(width)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div
            className="mx-auto h-[48rem] max-w-full overflow-hidden border border-white/15 bg-black transition-[width]"
            style={{ width: previewWidth }}
          >
            {previewUrl ? (
              <iframe
                className="h-full w-full"
                src={previewUrl}
                title="Live preview Bespoke"
              />
            ) : (
              <p className="p-4 text-sm text-white/50">
                Simpan order untuk membuat preview.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-5 border-t border-white/10 pt-7 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[.2em] text-[#d9b55a]">
            {orderStatus === "published"
              ? "Paid change request"
              : "Scope agreement"}
          </p>
          {orderStatus === "published" ? (
            <>
              <textarea
                className={`${control} min-h-24 py-3`}
                onChange={(event) => setChangeDescription(event.target.value)}
                placeholder="Alasan dan ringkasan perubahan setelah publikasi"
                value={changeDescription}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className={control}
                  inputMode="numeric"
                  onChange={(event) => setChangePriceDelta(event.target.value)}
                  placeholder="Biaya tambahan"
                  value={changePriceDelta}
                />
                <input
                  className={control}
                  inputMode="numeric"
                  onChange={(event) =>
                    setChangeScheduleDelta(event.target.value)
                  }
                  placeholder="Tambahan hari"
                  value={changeScheduleDelta}
                />
              </div>
            </>
          ) : null}
          <input
            className={control}
            onChange={(event) => setScopeSummary(event.target.value)}
            placeholder="Ringkasan konsep dan kebutuhan"
            value={scopeSummary}
          />
          <textarea
            className={`${control} min-h-28 py-3`}
            onChange={(event) => setDeliverables(event.target.value)}
            placeholder="Deliverables, satu per baris"
            value={deliverables}
          />
          <textarea
            className={`${control} min-h-24 py-3`}
            onChange={(event) => setExclusions(event.target.value)}
            placeholder="Di luar scope, satu per baris"
            value={exclusions}
          />
          {orderStatus !== "published" ? (
            <input
              className={control}
              inputMode="numeric"
              onChange={(event) => setTotalAmount(event.target.value)}
              value={totalAmount}
            />
          ) : null}
          <button
            className={button}
            disabled={
              busy ||
              !scopeSummary.trim() ||
              !deliverables.trim() ||
              (orderStatus === "published" && !changeDescription.trim())
            }
            onClick={() =>
              void (orderStatus === "published"
                ? createChangeRequest()
                : createScope())
            }
            type="button"
          >
            <Plus size={14} />{" "}
            {orderStatus === "published"
              ? "Buat change request"
              : "Buat versi scope"}
          </button>
        </div>
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[.2em] text-[#d9b55a]">
            Approval & publikasi
          </p>
          {scopes.map((scope) => (
            <article className="border border-white/10 p-4" key={scope.id}>
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-sm text-white">Scope v{scope.version}</p>
                  <p className="text-xs text-white/45">
                    {scope.status} · 8 revisi · 10–14 hari kerja
                  </p>
                </div>
                <button
                  className={button}
                  disabled={busy || scope.status === "approved"}
                  onClick={() => void createReview("scope", scope.id)}
                  type="button"
                >
                  <Send size={13} /> Review scope
                </button>
              </div>
            </article>
          ))}
          <button
            className={button}
            disabled={
              busy || !scopes.some((scope) => scope.status === "approved")
            }
            onClick={() => void createReview("final")}
            type="button"
          >
            <Copy size={14} /> Buat review final + OTP
          </button>
          <p className="text-xs leading-5 text-white/45">
            Full payment tetap diverifikasi server sebelum publikasi. Perubahan
            setelah publish harus menjadi change request dan versi publikasi
            baru.
          </p>
        </div>
      </div>
    </section>
  );
}
