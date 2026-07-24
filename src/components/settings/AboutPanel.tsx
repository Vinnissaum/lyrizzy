import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, ExternalLink } from "lucide-react";
import { checkForUpdates, getAppVersion, openExternalUrl } from "../../api/commands";
import { UpdateDialog } from "../system/UpdateDialog";
import type { UpdateInfo } from "../../types";

type CheckState = "idle" | "checking" | "upToDate" | { error: string };

const REPO_URL = "https://github.com/Vinnissaum/lyrizzy";

export const AboutPanel: React.FC = () => {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string | null>(null);
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const [available, setAvailable] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    getAppVersion().then(setVersion).catch(() => {});
  }, []);

  const handleCheck = async () => {
    setCheckState("checking");
    try {
      const result = await checkForUpdates(true);
      if (result.status === "updateAvailable") {
        setAvailable(result.info);
        setCheckState("idle");
      } else if (result.status === "upToDate") {
        setCheckState("upToDate");
      } else {
        setCheckState("idle");
      }
    } catch (err: unknown) {
      const code =
        err !== null && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : String(err);
      setCheckState({ error: code });
    }
  };

  const checking = checkState === "checking";

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-fg">Lyrizzy</p>
        <p className="text-xs text-muted">
          {t("about.version", { version: version ?? "…" })}
        </p>
      </div>

      <button
        onClick={handleCheck}
        disabled={checking}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border bg-surface hover:bg-surface-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {checking ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          <RefreshCw size={16} />
        )}
        {checking ? t("updates.checking") : t("updates.checkManual")}
      </button>

      {checkState === "upToDate" && (
        <p className="text-sm text-muted">{t("updates.upToDate")}</p>
      )}

      {typeof checkState === "object" && (
        <p className="text-sm text-danger">
          {t("updates.checkErrorWithCode", { code: checkState.error })}
        </p>
      )}

      {available && (
        <UpdateDialog update={available} onClose={() => setAvailable(null)} />
      )}

      <div className="pt-3 border-t border-border space-y-2">
        <p className="text-sm text-muted">{t("about.openSource")}</p>
        <a
          href={REPO_URL}
          onClick={(e) => {
            e.preventDefault();
            openExternalUrl(REPO_URL).catch(() => {});
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border bg-surface hover:bg-surface-2 transition-colors"
        >
          <ExternalLink size={16} />
          {t("about.contribute")}
        </a>
      </div>
    </div>
  );
};
