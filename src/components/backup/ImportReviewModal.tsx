import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  ImportPlan,
  ImportPlanItem,
  Resolution,
  ResolutionAction,
} from "../../api/commands";

interface Props {
  plan: ImportPlan;
  busy?: boolean;
  onConfirm: (resolutions: Resolution[]) => void;
  onCancel: () => void;
}

const ACTIONS: ResolutionAction[] = ["skip", "overwrite", "copy"];

/**
 * Renders an {@link ImportPlan} and collects a per-conflict resolution
 * (skip / overwrite / copy). No-conflict items need no choice — they import
 * as-is (the backend treats a missing/"overwrite" resolution as insert-as-is).
 */
export const ImportReviewModal: React.FC<Props> = ({
  plan,
  busy,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();

  // Seed every item with its suggested default; conflict items are editable.
  const [actions, setActions] = useState<Record<string, ResolutionAction>>(() => {
    const seed: Record<string, ResolutionAction> = {};
    for (const item of plan.items) seed[item.id] = item.defaultAction;
    return seed;
  });

  const hasConflicts = plan.items.some((i) => i.conflict !== null);

  const handleConfirm = () => {
    const resolutions: Resolution[] = plan.items.map((item) => ({
      id: item.id,
      action: actions[item.id] ?? item.defaultAction,
    }));
    onConfirm(resolutions);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("artifact.review.title")}
    >
      <div className="bg-surface rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <h3 className="font-semibold">{t("artifact.review.title")}</h3>
          <p className="text-xs text-muted mt-1">
            {t(`artifact.review.kind.${plan.kind}`)} ·{" "}
            {t("artifact.review.summary", {
              songs: plan.counts.songs,
              sets: plan.counts.sets,
              media: plan.counts.media,
            })}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {!hasConflicts && (
            <p className="text-xs text-success bg-success-bg border border-success rounded-lg px-3 py-2">
              {t("artifact.review.noConflicts")}
            </p>
          )}

          {plan.items.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">
              {t("artifact.review.summary", {
                songs: plan.counts.songs,
                sets: plan.counts.sets,
                media: plan.counts.media,
              })}
            </p>
          ) : (
            plan.items.map((item) => (
              <ItemRow
                key={`${item.artifactType}-${item.id}`}
                item={item}
                action={actions[item.id] ?? item.defaultAction}
                onChange={(a) => setActions((prev) => ({ ...prev, [item.id]: a }))}
              />
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm text-muted hover:text-inherit transition-colors disabled:opacity-50"
          >
            {t("artifact.review.cancel")}
          </button>
          <button
            data-testid="artifact-import-confirm"
            onClick={handleConfirm}
            disabled={busy}
            className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-fg-on-primary rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {busy ? t("artifact.review.importing") : t("artifact.review.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
};

const ItemRow: React.FC<{
  item: ImportPlanItem;
  action: ResolutionAction;
  onChange: (a: ResolutionAction) => void;
}> = ({ item, action, onChange }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-surface-2 rounded-lg px-3 py-2 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm truncate">{item.title || item.id}</p>
        <p className="text-[11px] text-muted">
          {t(`artifact.review.type.${item.artifactType}`)}
          {item.conflict && (
            <span className="ml-2 text-warning">
              {t(`artifact.review.conflict.${item.conflict}`)}
            </span>
          )}
        </p>
      </div>

      {item.conflict ? (
        <select
          aria-label={`${item.title || item.id} ${t("artifact.review.resolution")}`}
          value={action}
          onChange={(e) => onChange(e.target.value as ResolutionAction)}
          className="text-xs bg-surface border border-border rounded px-2 py-1 focus:outline-none focus:border-primary"
        >
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {t(`artifact.review.action.${a}`)}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-[11px] text-success shrink-0">
          {t("artifact.review.willImport")}
        </span>
      )}
    </div>
  );
};
