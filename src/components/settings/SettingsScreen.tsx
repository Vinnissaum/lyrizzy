import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { LanguagePicker } from "./LanguagePicker";
import { KeyBindingsScreen } from "./KeyBindingsScreen";
import { MonitorPicker } from "./MonitorPicker";
import { CCLIReportScreen } from "../reports/CCLIReportScreen";
import { UpdateCheckButton } from "../system/UpdateCheckButton";
import { useSettingsStore } from "../../stores/settings";
import type {
  BackgroundPreset,
  BoldLevel,
  FontFamily,
  FontSize,
  LineSpacing,
  Margin,
  RepeatMode,
  ScreenPosition,
} from "../../types";

const FONT_SIZE_OPTIONS: FontSize[] = ["sm", "md", "lg", "xl", "xxl"];
const FONT_FAMILY_OPTIONS: FontFamily[] = ["sans", "serif", "mono"];
const PRESET_OPTIONS: BackgroundPreset[] = ["preto-branco", "branco-preto"];
const MARGIN_OPTIONS: Margin[] = ["none", "sm", "md", "lg", "xl"];
const REPEAT_MODE_OPTIONS: RepeatMode[] = ["duplicate", "annotate"];
const LINE_SPACING_OPTIONS: LineSpacing[] = ["tight", "normal", "relaxed", "loose"];
const BOLD_LEVEL_OPTIONS: BoldLevel[] = ["normal", "medium", "semibold", "bold"];
const THEME_OPTIONS: ("light" | "dark" | "black")[] = ["light", "dark", "black"];

const TAB_IDS = [
  "general",
  "projection",
  "announcement",
  "keybindings",
  "reports",
  "about",
] as const;
type TabId = (typeof TAB_IDS)[number];
const POSITION_GRID: ScreenPosition[] = [
  "top-left", "top-center", "top-right",
  "center-left", "center", "center-right",
  "bottom-left", "bottom-center", "bottom-right",
];

// ── Reusable controls ─────────────────────────────────────────────────────────

function ButtonGroup<T extends string>({
  label,
  value,
  options,
  optionLabel,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  optionLabel: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex gap-1 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            aria-pressed={value === opt}
            onClick={() => onChange(opt)}
            className={`flex-1 min-w-[64px] px-2 py-1.5 text-sm rounded-lg border transition-colors ${
              value === opt
                ? "bg-primary text-fg-on-primary border-primary"
                : "bg-surface border-border text-muted hover:text-inherit"
            }`}
          >
            {optionLabel(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}

function BoolToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex rounded-lg overflow-hidden border border-border text-sm">
        {[true, false].map((opt) => (
          <button
            key={String(opt)}
            type="button"
            aria-pressed={value === opt}
            onClick={() => onChange(opt)}
            className={`px-3 py-1.5 transition-colors ${
              value === opt
                ? "bg-primary text-fg-on-primary"
                : "bg-surface text-muted hover:text-inherit hover:bg-surface-2"
            }`}
          >
            {opt ? t("common.on") : t("common.off")}
          </button>
        ))}
      </div>
    </div>
  );
}

function PositionGrid({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ScreenPosition;
  onChange: (v: ScreenPosition) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{label}</p>
      <div className="inline-grid grid-cols-3 gap-0.5 p-1 bg-surface border border-border rounded-lg">
        {POSITION_GRID.map((pos) => (
          <button
            key={pos}
            type="button"
            aria-label={pos}
            aria-pressed={value === pos}
            onClick={() => onChange(pos)}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
              value === pos ? "bg-primary" : "bg-surface-2 hover:bg-border"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                value === pos ? "bg-fg-on-primary" : "bg-muted"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const s = useSettingsStore();
  const [activeTab, setActiveTab] = useState<TabId>("general");

  const fontSizeLabel = (v: FontSize) => t(`settings.windows.fontSizes.${v}`);
  const fontFamilyLabel = (v: FontFamily) => t(`settings.appearance.fontFamilies.${v}`);
  const presetLabel = (v: BackgroundPreset) =>
    t(`settings.appearance.themes.${v === "preto-branco" ? "dark" : "light"}`);
  const marginLabel = (v: Margin) => t(`settings.appearance.margins.${v}`);
  const repeatModeLabel = (v: RepeatMode) => t(`settings.appearance.repeatModes.${v}`);
  const lineSpacingLabel = (v: LineSpacing) => t(`settings.appearance.lineSpacings.${v}`);
  const boldLevelLabel = (v: BoldLevel) => t(`settings.appearance.boldLevels.${v}`);

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-6 max-w-lg w-full mx-auto">
        <h2 className="text-lg font-semibold mb-4">{t("settings.title")}</h2>
        <div role="tablist" className="flex gap-1 flex-wrap border-b border-border">
          {TAB_IDS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-sm rounded-t-lg border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? "border-primary text-inherit font-medium"
                  : "border-transparent text-muted hover:text-inherit"
              }`}
            >
              {t(`settings.tabs.${tab}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
        <div className="max-w-lg mx-auto space-y-6">
          {activeTab === "general" && (
            <>
              <div className="bg-surface-2 rounded-xl p-4 space-y-4">
                <h3 className="text-xs font-medium text-muted uppercase tracking-wider">
                  {t("settings.general")}
                </h3>
                <LanguagePicker />
                <ButtonGroup
                  label={t("settings.themeMode.label")}
                  value={s.theme}
                  options={THEME_OPTIONS}
                  optionLabel={(v) => t(`settings.themeMode.${v}`)}
                  onChange={s.setTheme}
                />
              </div>

              <div className="bg-surface-2 rounded-xl p-4 space-y-4">
                <h3 className="text-xs font-medium text-muted uppercase tracking-wider">
                  {t("settings.windows.title")}
                </h3>
                <MonitorPicker />
              </div>
            </>
          )}

          {activeTab === "projection" && (
            <div className="bg-surface-2 rounded-xl p-4 space-y-4">
              <h3 className="text-xs font-medium text-muted uppercase tracking-wider">
                {t("settings.appearance.title")}
              </h3>
              <ButtonGroup
                label={t("settings.windows.fontSize")}
                value={s.presentationFontSize}
                options={FONT_SIZE_OPTIONS}
                optionLabel={fontSizeLabel}
                onChange={s.setPresentationFontSize}
              />
              <ButtonGroup
                label={t("settings.appearance.fontFamily")}
                value={s.presentationFontFamily}
                options={FONT_FAMILY_OPTIONS}
                optionLabel={fontFamilyLabel}
                onChange={s.setPresentationFontFamily}
              />
              <ButtonGroup
                label={t("settings.appearance.lineSpacing")}
                value={s.presentationLineSpacing}
                options={LINE_SPACING_OPTIONS}
                optionLabel={lineSpacingLabel}
                onChange={s.setPresentationLineSpacing}
              />
              <ButtonGroup
                label={t("settings.appearance.boldLevel")}
                value={s.presentationBoldLevel}
                options={BOLD_LEVEL_OPTIONS}
                optionLabel={boldLevelLabel}
                onChange={s.setPresentationBoldLevel}
              />
              <ButtonGroup
                label={t("settings.appearance.theme")}
                value={s.presentationPreset}
                options={PRESET_OPTIONS}
                optionLabel={presetLabel}
                onChange={s.setPresentationPreset}
              />
              <PositionGrid
                label={t("settings.appearance.position")}
                value={s.presentationPosition}
                onChange={s.setPresentationPosition}
              />
              <ButtonGroup
                label={t("settings.appearance.margin")}
                value={s.presentationMargin}
                options={MARGIN_OPTIONS}
                optionLabel={marginLabel}
                onChange={s.setPresentationMargin}
              />
              <ButtonGroup
                label={t("settings.appearance.repeatMode")}
                value={s.presentationRepeatMode}
                options={REPEAT_MODE_OPTIONS}
                optionLabel={repeatModeLabel}
                onChange={s.setPresentationRepeatMode}
              />
              <BoolToggle
                label={t("settings.appearance.titleSlide")}
                value={s.showTitleSlide}
                onChange={s.setShowTitleSlide}
              />
              <BoolToggle
                label={t("settings.appearance.authorParens")}
                value={s.authorInParens}
                onChange={s.setAuthorInParens}
              />
              <BoolToggle
                label={t("settings.blackoutAfterSong")}
                value={s.blackoutAfterSong}
                onChange={s.setBlackoutAfterSong}
              />
            </div>
          )}

          {activeTab === "announcement" && (
            <div className="bg-surface-2 rounded-xl p-4 space-y-4">
              <h3 className="text-xs font-medium text-muted uppercase tracking-wider">
                {t("settings.announcement.title")}
              </h3>
              <ButtonGroup
                label={t("settings.appearance.fontFamily")}
                value={s.announcementFontFamily}
                options={FONT_FAMILY_OPTIONS}
                optionLabel={fontFamilyLabel}
                onChange={s.setAnnouncementFontFamily}
              />
              <ButtonGroup
                label={t("settings.windows.fontSize")}
                value={s.announcementFontSize}
                options={FONT_SIZE_OPTIONS}
                optionLabel={fontSizeLabel}
                onChange={s.setAnnouncementFontSize}
              />
              <ButtonGroup
                label={t("settings.appearance.lineSpacing")}
                value={s.announcementLineSpacing}
                options={LINE_SPACING_OPTIONS}
                optionLabel={lineSpacingLabel}
                onChange={s.setAnnouncementLineSpacing}
              />
              <ButtonGroup
                label={t("settings.appearance.boldLevel")}
                value={s.announcementBoldLevel}
                options={BOLD_LEVEL_OPTIONS}
                optionLabel={boldLevelLabel}
                onChange={s.setAnnouncementBoldLevel}
              />
              <ButtonGroup
                label={t("settings.appearance.theme")}
                value={s.announcementPreset}
                options={PRESET_OPTIONS}
                optionLabel={presetLabel}
                onChange={s.setAnnouncementPreset}
              />
              <PositionGrid
                label={t("settings.appearance.position")}
                value={s.announcementPosition}
                onChange={s.setAnnouncementPosition}
              />
              <ButtonGroup
                label={t("settings.announcementMargin")}
                value={s.announcementMargin}
                options={MARGIN_OPTIONS}
                optionLabel={marginLabel}
                onChange={s.setAnnouncementMargin}
              />
            </div>
          )}

          {activeTab === "keybindings" && (
            <div className="bg-surface-2 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-medium text-muted uppercase tracking-wider">
                {t("keyBindings.title")}
              </h3>
              <KeyBindingsScreen />
            </div>
          )}

          {activeTab === "reports" && (
            <div className="bg-surface-2 rounded-xl p-4 space-y-4">
              <h3 className="text-xs font-medium text-muted uppercase tracking-wider">
                {t("reports.ccli.title")}
              </h3>
              <CCLIReportScreen />
            </div>
          )}

          {activeTab === "about" && (
            <div className="bg-surface-2 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-medium text-muted uppercase tracking-wider">
                {t("settings.about")}
              </h3>
              <UpdateCheckButton />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
