import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { save } from "@tauri-apps/plugin-dialog";
import { previewCcliExport, exportCcliCsv, type CcliRow } from "../../api/commands";

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function iso90DaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}

export const CCLIReportScreen: React.FC = () => {
  const { t } = useTranslation();
  const [from, setFrom] = useState(iso90DaysAgo);
  const [to, setTo] = useState(isoToday);
  const [rows, setRows] = useState<CcliRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchPreview = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    try {
      const data = await previewCcliExport(from, to);
      setRows(data);
    } catch (err: unknown) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    const timer = setTimeout(fetchPreview, 200);
    return () => clearTimeout(timer);
  }, [fetchPreview]);

  const handleExport = async () => {
    const defaultName = `ccli-report-${from}-to-${to}.csv`;
    const outPath = await save({
      filters: [{ name: "CSV", extensions: ["csv"] }],
      defaultPath: defaultName,
    });
    if (!outPath) return;

    setExporting(true);
    try {
      const count = await exportCcliCsv(from, to, outPath);
      if (count === 0) {
        showToast(t("reports.ccli.emptyToast"));
      } else {
        showToast(t("reports.ccli.exportSuccess", { count }));
      }
    } catch (err: unknown) {
      setError(String(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4 relative">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Date range */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-gray-300">
          {t("reports.ccli.from")}
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          {t("reports.ccli.to")}
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
          />
        </label>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="ml-auto px-4 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg font-medium transition-colors"
        >
          {exporting ? t("reports.ccli.exporting") : t("reports.ccli.exportButton")}
        </button>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {/* Preview table */}
      {loading ? (
        <p className="text-gray-500 text-sm py-4 text-center">{t("loading")}</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-600 text-sm py-4 text-center">{t("reports.ccli.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-700">
                <th className="pb-2 pr-4">{t("reports.ccli.col.date")}</th>
                <th className="pb-2 pr-4">{t("reports.ccli.col.title")}</th>
                <th className="pb-2 pr-4">{t("reports.ccli.col.author")}</th>
                <th className="pb-2 pr-4">{t("reports.ccli.col.ccliNumber")}</th>
                <th className="pb-2">{t("reports.ccli.col.copyright")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {rows.map((row, i) => (
                <tr key={i} className="text-gray-300 hover:bg-gray-800/50">
                  <td className="py-2 pr-4 text-gray-400 tabular-nums">{row.playedOn}</td>
                  <td className="py-2 pr-4 font-medium text-white">{row.title}</td>
                  <td className="py-2 pr-4">{row.author ?? "—"}</td>
                  <td className="py-2 pr-4">{row.ccliNumber ?? "—"}</td>
                  <td className="py-2">{row.copyright ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-600 mt-2">
            {t("reports.ccli.rowCount", { count: rows.length })}
          </p>
        </div>
      )}
    </div>
  );
};
