import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import { alpha } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useMobileBackHandler } from "@/hooks/use-mobile-back-handler";

/**
 * Material Design 3 primitives for the mobile shell (baseline color scheme).
 * Specs: https://m3.material.io/components
 */
export interface M3Tokens {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  surface: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  /** Custom "success" role (harmonized green), used for status chips */
  successContainer: string;
  onSuccessContainer: string;
}

const LIGHT: M3Tokens = {
  primary: "#6750A4",
  onPrimary: "#FFFFFF",
  primaryContainer: "#EADDFF",
  onPrimaryContainer: "#21005D",
  secondaryContainer: "#E8DEF8",
  onSecondaryContainer: "#1D192B",
  surface: "#FEF7FF",
  surfaceContainerLow: "#F7F2FA",
  surfaceContainer: "#F3EDF7",
  surfaceContainerHigh: "#ECE6F0",
  surfaceContainerHighest: "#E6E0E9",
  onSurface: "#1D1B20",
  onSurfaceVariant: "#49454F",
  outline: "#79747E",
  outlineVariant: "#CAC4D0",
  error: "#B3261E",
  onError: "#FFFFFF",
  errorContainer: "#F9DEDC",
  onErrorContainer: "#410E0B",
  successContainer: "#C4EED0",
  onSuccessContainer: "#07210F",
};

const DARK: M3Tokens = {
  primary: "#D0BCFF",
  onPrimary: "#381E72",
  primaryContainer: "#4F378B",
  onPrimaryContainer: "#EADDFF",
  secondaryContainer: "#4A4458",
  onSecondaryContainer: "#E8DEF8",
  surface: "#141218",
  surfaceContainerLow: "#1D1B20",
  surfaceContainer: "#211F26",
  surfaceContainerHigh: "#2B2930",
  surfaceContainerHighest: "#36343B",
  onSurface: "#E6E0E9",
  onSurfaceVariant: "#CAC4D0",
  outline: "#938F99",
  outlineVariant: "#49454F",
  error: "#F2B8B5",
  onError: "#601410",
  errorContainer: "#8C1D18",
  onErrorContainer: "#F9DEDC",
  successContainer: "#1F5130",
  onSuccessContainer: "#C4EED0",
};

/** Dark scheme with true-black surfaces; containers step up in small increments. */
const OLED: M3Tokens = {
  ...DARK,
  surface: "#000000",
  surfaceContainerLow: "#0B0A0D",
  surfaceContainer: "#121115",
  surfaceContainerHigh: "#1A191D",
  surfaceContainerHighest: "#242327",
  outlineVariant: "#36343B",
};

export type M3Mode = "light" | "dark" | "oled";

function readMode(): M3Mode {
  const cl = document.documentElement.classList;
  if (cl.contains("oled")) return "oled";
  if (cl.contains("dark")) return "dark";
  return "light";
}

export function useM3Mode(): M3Mode {
  const [mode, setMode] = useState<M3Mode>(() =>
    typeof document !== "undefined" ? readMode() : "light"
  );
  useEffect(() => {
    const sync = () => setMode(readMode());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return mode;
}

const SCHEMES: Record<M3Mode, M3Tokens> = { light: LIGHT, dark: DARK, oled: OLED };

const M3Context = createContext<M3Tokens>(LIGHT);

export const M3Provider = ({ children }: { children: ReactNode }) => {
  const mode = useM3Mode();
  return <M3Context.Provider value={SCHEMES[mode]}>{children}</M3Context.Provider>;
};

export const useM3 = () => useContext(M3Context);

const EASE = "cubic-bezier(0.2, 0, 0, 1)";

/* ------------------------------------------------------------------ */
/* Switch — https://m3.material.io/components/switch/specs             */
/* ------------------------------------------------------------------ */

export const M3Switch = ({
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) => {
  const t = useM3();
  const [pressed, setPressed] = useState(false);
  const thumb = pressed ? 28 : checked ? 24 : 16;
  const inset = (28 - thumb) / 2;
  const left = checked ? 48 - thumb - inset : inset;

  return (
    <Box
      component="button"
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      sx={{
        position: "relative",
        flexShrink: 0,
        width: 52,
        height: 32,
        p: 0,
        borderRadius: "16px",
        boxSizing: "border-box",
        border: "2px solid",
        borderColor: checked ? t.primary : t.outline,
        bgcolor: checked ? t.primary : t.surfaceContainerHighest,
        cursor: "pointer",
        opacity: disabled ? 0.38 : 1,
        transition: `background-color 200ms ${EASE}, border-color 200ms ${EASE}`,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <Box
        component="span"
        sx={{
          position: "absolute",
          top: inset,
          left,
          width: thumb,
          height: thumb,
          borderRadius: "50%",
          bgcolor: checked ? t.onPrimary : t.outline,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: `all 250ms ${EASE}`,
          "&::before": {
            content: '""',
            position: "absolute",
            inset: -((40 - thumb) / 2),
            borderRadius: "50%",
            bgcolor: pressed ? alpha(checked ? t.primary : t.onSurface, 0.1) : "transparent",
            transition: `background-color 150ms ${EASE}`,
          },
        }}
      >
        {checked && (
          <CheckIcon sx={{ fontSize: 16, color: t.onPrimaryContainer, position: "relative" }} />
        )}
      </Box>
    </Box>
  );
};

/* ------------------------------------------------------------------ */
/* Buttons — https://m3.material.io/components/all-buttons             */
/* ------------------------------------------------------------------ */

export type M3ButtonVariant = "filled" | "tonal" | "outlined" | "text";

export const M3Button = ({
  variant = "filled",
  icon,
  children,
  onClick,
  disabled,
  fullWidth,
  danger,
  type = "button",
}: {
  variant?: M3ButtonVariant;
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  danger?: boolean;
  type?: "button" | "submit";
}) => {
  const t = useM3();
  const accent = danger ? t.error : t.primary;
  const styles: Record<M3ButtonVariant, { bg: string; fg: string; border?: string }> = {
    filled: { bg: accent, fg: danger ? "#FFFFFF" : t.onPrimary },
    tonal: { bg: t.secondaryContainer, fg: t.onSecondaryContainer },
    outlined: { bg: "transparent", fg: accent, border: t.outline },
    text: { bg: "transparent", fg: accent },
  };
  const s = styles[variant];
  const px = variant === "text" ? (icon ? 1.5 : 1.5) : icon ? 2 : 3;

  return (
    <ButtonBase
      type={type}
      onClick={onClick}
      disabled={disabled}
      sx={{
        height: 40,
        minWidth: 48,
        width: fullWidth ? "100%" : "auto",
        px,
        gap: 1,
        borderRadius: "20px",
        bgcolor: disabled
          ? variant === "filled" || variant === "tonal"
            ? alpha(t.onSurface, 0.12)
            : "transparent"
          : s.bg,
        color: disabled ? alpha(t.onSurface, 0.38) : s.fg,
        border: s.border ? `1px solid ${disabled ? alpha(t.onSurface, 0.12) : s.border}` : "none",
        fontFamily: "Roboto, system-ui, sans-serif",
        fontSize: "0.875rem",
        fontWeight: 500,
        letterSpacing: "0.1px",
        lineHeight: "20px",
        overflow: "hidden",
        position: "relative",
        transition: `background-color 150ms ${EASE}`,
        "& .MuiSvgIcon-root, & svg": { fontSize: 18, width: 18, height: 18 },
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          bgcolor: s.fg,
          opacity: 0,
          transition: `opacity 150ms ${EASE}`,
        },
        "&:active::after": { opacity: 0.1 },
        "& .MuiTouchRipple-root": { color: s.fg },
      }}
    >
      {icon}
      {children}
    </ButtonBase>
  );
};

/* ------------------------------------------------------------------ */
/* Search bar — https://m3.material.io/components/search/specs         */
/* ------------------------------------------------------------------ */

export const M3SearchBar = ({
  value,
  onChange,
  placeholder,
  active,
  onActiveChange,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  active: boolean;
  onActiveChange: (active: boolean) => void;
}) => {
  const t = useM3();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Box
      onClick={() => inputRef.current?.focus()}
      sx={{
        display: "flex",
        alignItems: "center",
        height: 56,
        borderRadius: active ? "28px 28px 0 0" : "28px",
        bgcolor: t.surfaceContainerHigh,
        px: 0.5,
        transition: `border-radius 200ms ${EASE}`,
      }}
    >
      <ButtonBase
        aria-label={active ? "Close search" : "Search"}
        onClick={(e) => {
          e.stopPropagation();
          if (active) {
            onChange("");
            onActiveChange(false);
            inputRef.current?.blur();
          } else {
            inputRef.current?.focus();
          }
        }}
        sx={{ width: 48, height: 48, borderRadius: "50%", color: t.onSurface }}
      >
        {active ? <ArrowBackIcon /> : <SearchIcon />}
      </ButtonBase>
      <Box
        component="input"
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        onFocus={() => onActiveChange(true)}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        sx={{
          flex: 1,
          minWidth: 0,
          height: "100%",
          border: 0,
          outline: "none",
          bgcolor: "transparent",
          color: t.onSurface,
          fontFamily: "Roboto, system-ui, sans-serif",
          fontSize: "1rem",
          letterSpacing: "0.5px",
          px: 0.5,
          "&::placeholder": { color: t.onSurfaceVariant, opacity: 1 },
        }}
      />
      {value && (
        <ButtonBase
          aria-label="Clear"
          onClick={(e) => {
            e.stopPropagation();
            onChange("");
            inputRef.current?.focus();
          }}
          sx={{ width: 48, height: 48, borderRadius: "50%", color: t.onSurfaceVariant }}
        >
          <CloseIcon />
        </ButtonBase>
      )}
    </Box>
  );
};

/* ------------------------------------------------------------------ */
/* Radio — https://m3.material.io/components/radio-button/specs        */
/* ------------------------------------------------------------------ */

export const M3Radio = ({ checked }: { checked: boolean }) => {
  const t = useM3();
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        width: 20,
        height: 20,
        flexShrink: 0,
        borderRadius: "50%",
        border: "2px solid",
        borderColor: checked ? t.primary : t.onSurfaceVariant,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        transition: `border-color 150ms ${EASE}`,
        "&::after": {
          content: '""',
          width: 10,
          height: 10,
          borderRadius: "50%",
          bgcolor: t.primary,
          transform: checked ? "scale(1)" : "scale(0)",
          transition: `transform 150ms ${EASE}`,
        },
      }}
    />
  );
};

/* ------------------------------------------------------------------ */
/* Basic dialog — https://m3.material.io/components/dialogs/guidelines */
/* Rendered inline (no portal) so it stays inside the host Radix dialog */
/* ------------------------------------------------------------------ */

export const M3Dialog = ({
  open,
  title,
  supportingText,
  children,
  actions,
  onDismiss,
}: {
  open: boolean;
  title: string;
  supportingText?: string;
  children?: ReactNode;
  actions: ReactNode;
  onDismiss: () => void;
}) => {
  const t = useM3();
  if (!open) return null;

  return (
    <Box
      role="presentation"
      onClick={onDismiss}
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 20,
        bgcolor: "rgba(0,0,0,0.32)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 3,
        animation: `m3-fade-in 150ms ${EASE}`,
        "@keyframes m3-fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
      }}
    >
      <Box
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        sx={{
          width: "100%",
          minWidth: 280,
          maxWidth: 560,
          maxHeight: "80dvh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "28px",
          bgcolor: t.surfaceContainerHigh,
          color: t.onSurface,
          fontFamily: "Roboto, system-ui, sans-serif",
          animation: `m3-dialog-in 250ms ${EASE}`,
          "@keyframes m3-dialog-in": {
            from: { opacity: 0, transform: "scale(0.9)" },
            to: { opacity: 1, transform: "scale(1)" },
          },
        }}
      >
        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
          <Box sx={{ fontSize: "1.5rem", lineHeight: "32px", fontWeight: 400 }}>{title}</Box>
          {supportingText && (
            <Box sx={{ mt: 2, fontSize: "0.875rem", lineHeight: "20px", color: t.onSurfaceVariant }}>
              {supportingText}
            </Box>
          )}
        </Box>
        {children && (
          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              borderTop: `1px solid ${t.outlineVariant}`,
              borderBottom: `1px solid ${t.outlineVariant}`,
            }}
          >
            {children}
          </Box>
        )}
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, px: 3, pt: 2.5, pb: 3 }}>
          {actions}
        </Box>
      </Box>
    </Box>
  );
};

export interface M3Option {
  value: string;
  label: string;
  description?: string;
}

/** Single-choice confirmation dialog (radio list + Cancel / OK). */
export const M3SelectDialog = ({
  open,
  title,
  options,
  value,
  onConfirm,
  onDismiss,
}: {
  open: boolean;
  title: string;
  options: M3Option[];
  value: string;
  onConfirm: (value: string) => void;
  onDismiss: () => void;
}) => {
  const t = useM3();
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  return (
    <M3Dialog
      open={open}
      title={title}
      onDismiss={onDismiss}
      actions={
        <>
          <M3Button variant="text" onClick={onDismiss}>
            Cancel
          </M3Button>
          <M3Button variant="text" onClick={() => onConfirm(draft)}>
            OK
          </M3Button>
        </>
      }
    >
      <Box role="radiogroup" sx={{ py: 1 }}>
        {options.map((o) => (
          <ButtonBase
            key={o.value}
            role="radio"
            aria-checked={draft === o.value}
            onClick={() => setDraft(o.value)}
            sx={{
              width: "100%",
              minHeight: 56,
              px: 3,
              py: 1,
              gap: 2,
              justifyContent: "flex-start",
              textAlign: "left",
              color: t.onSurface,
            }}
          >
            <M3Radio checked={draft === o.value} />
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ fontSize: "1rem", lineHeight: "24px", letterSpacing: "0.5px" }}>
                {o.label}
              </Box>
              {o.description && (
                <Box sx={{ fontSize: "0.875rem", lineHeight: "20px", color: t.onSurfaceVariant }}>
                  {o.description}
                </Box>
              )}
            </Box>
          </ButtonBase>
        ))}
      </Box>
    </M3Dialog>
  );
};

/* ------------------------------------------------------------------ */
/* Outlined text field — https://m3.material.io/components/text-fields */
/* ------------------------------------------------------------------ */

export const M3TextField = ({
  label,
  value,
  onChange,
  placeholder,
  monospace,
  supportingText,
  error,
  labelBackground,
  type = "text",
  inputMode,
  prefix,
  trailing,
  autoFocus,
  disabled,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  monospace?: boolean;
  supportingText?: string;
  /** Error message; replaces supporting text and switches to the error color role */
  error?: string;
  /** Must match the container behind the field so the label can notch the outline */
  labelBackground?: string;
  type?: "text" | "password" | "number" | "url";
  inputMode?: "text" | "numeric" | "url" | "email";
  prefix?: string;
  trailing?: ReactNode;
  autoFocus?: boolean;
  disabled?: boolean;
  id?: string;
}) => {
  const t = useM3();
  const [focused, setFocused] = useState(false);
  const color = error ? t.error : focused ? t.primary : t.outline;
  const labelColor = error ? t.error : focused ? t.primary : t.onSurfaceVariant;

  return (
    <Box sx={{ width: "100%", opacity: disabled ? 0.38 : 1 }}>
      <Box
        component="label"
        sx={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          height: 56,
          borderRadius: "4px",
          border: `${focused || error ? 2 : 1}px solid ${color}`,
          boxSizing: "border-box",
          transition: `border-color 150ms ${EASE}`,
        }}
      >
        <Box
          component="span"
          sx={{
            position: "absolute",
            top: -9,
            left: 12,
            px: 0.5,
            bgcolor: labelBackground ?? t.surface,
            color: labelColor,
            fontSize: "0.75rem",
            lineHeight: "16px",
            letterSpacing: "0.4px",
            fontFamily: "Roboto, system-ui, sans-serif",
            pointerEvents: "none",
          }}
        >
          {label}
        </Box>
        {prefix && (
          <Box component="span" sx={{ pl: 2, color: t.onSurfaceVariant, fontSize: "1rem" }}>
            {prefix}
          </Box>
        )}
        <Box
          component="input"
          id={id}
          size={1}
          type={type}
          inputMode={inputMode}
          autoFocus={autoFocus}
          disabled={disabled}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          sx={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            border: 0,
            outline: "none",
            bgcolor: "transparent",
            color: t.onSurface,
            caretColor: error ? t.error : t.primary,
            pl: prefix ? 0.5 : 2,
            pr: trailing ? 0 : 2,
            fontSize: "1rem",
            letterSpacing: "0.5px",
            fontFamily: monospace ? "ui-monospace, monospace" : "Roboto, system-ui, sans-serif",
            "&::placeholder": { color: t.onSurfaceVariant, opacity: 0.7 },
          }}
        />
        {trailing && <Box sx={{ display: "flex", pr: 0.5 }}>{trailing}</Box>}
      </Box>
      {(error || supportingText) && (
        <Box
          sx={{
            px: 2,
            pt: 0.5,
            fontSize: "0.75rem",
            lineHeight: "16px",
            letterSpacing: "0.4px",
            color: error ? t.error : t.onSurfaceVariant,
          }}
        >
          {error || supportingText}
        </Box>
      )}
    </Box>
  );
};

/* ------------------------------------------------------------------ */
/* Icon button — https://m3.material.io/components/icon-buttons        */
/* ------------------------------------------------------------------ */

export const M3IconButton = ({
  icon,
  label,
  onClick,
  disabled,
  color,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  color?: string;
}) => {
  const t = useM3();
  return (
    <ButtonBase
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      sx={{
        width: 48,
        height: 48,
        flexShrink: 0,
        borderRadius: "50%",
        color: disabled ? alpha(t.onSurface, 0.38) : color ?? t.onSurfaceVariant,
        "& .MuiSvgIcon-root": { fontSize: 24 },
      }}
    >
      {icon}
    </ButtonBase>
  );
};

/* ------------------------------------------------------------------ */
/* Chips — https://m3.material.io/components/chips                     */
/* ------------------------------------------------------------------ */

export const M3Chip = ({
  label,
  icon,
  tone = "neutral",
  trailingIcon,
  onClick,
}: {
  label: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "primary" | "success" | "error";
  trailingIcon?: ReactNode;
  onClick?: () => void;
}) => {
  const t = useM3();
  const tones = {
    neutral: { bg: "transparent", fg: t.onSurfaceVariant, border: t.outline },
    primary: { bg: t.secondaryContainer, fg: t.onSecondaryContainer, border: "transparent" },
    success: { bg: t.successContainer, fg: t.onSuccessContainer, border: "transparent" },
    error: { bg: t.errorContainer, fg: t.onErrorContainer, border: "transparent" },
  }[tone];
  return (
    <Box
      component={onClick ? ButtonBase : "span"}
      onClick={onClick}
      sx={{
        maxWidth: "100%",
        overflow: "hidden",
        fontFamily: "Roboto, system-ui, sans-serif",
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        height: 32,
        px: icon ? 1 : 2,
        pr: trailingIcon ? 1 : 2,
        borderRadius: "8px",
        border: `1px solid ${tones.border}`,
        bgcolor: tones.bg,
        color: tones.fg,
        fontSize: "0.875rem",
        fontWeight: 500,
        letterSpacing: "0.1px",
        whiteSpace: "nowrap",
        flexShrink: 0,
        "& .MuiSvgIcon-root": { fontSize: 18 },
      }}
    >
      {icon}
      {label}
      {trailingIcon}
    </Box>
  );
};

/* ------------------------------------------------------------------ */
/* Cards — https://m3.material.io/components/cards                     */
/* ------------------------------------------------------------------ */

export const M3Card = ({
  children,
  variant = "filled",
  sx,
}: {
  children: ReactNode;
  variant?: "filled" | "outlined" | "elevated";
  sx?: Record<string, unknown>;
}) => {
  const t = useM3();
  return (
    <Box
      sx={{
        borderRadius: "16px",
        overflow: "hidden",
        bgcolor:
          variant === "filled"
            ? t.surfaceContainerHighest
            : variant === "elevated"
              ? t.surfaceContainerLow
              : t.surface,
        border: variant === "outlined" ? `1px solid ${t.outlineVariant}` : "none",
        boxShadow:
          variant === "elevated"
            ? "0 1px 2px rgba(0,0,0,0.3), 0 1px 3px 1px rgba(0,0,0,0.15)"
            : "none",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

/* ------------------------------------------------------------------ */
/* Full-screen dialog — https://m3.material.io/components/dialogs      */
/* ------------------------------------------------------------------ */

export const M3FullScreenDialog = ({
  open,
  title,
  onClose,
  onBack,
  action,
  headerActions,
  leading = "close",
  children,
}: {
  open: boolean;
  title: string;
  /** Called by the Radix dialog when it wants to close (outside tap, nav bar, Escape) */
  onClose: () => void;
  /** Android back / top-bar navigation; defaults to onClose */
  onBack?: () => void;
  /** Confirming text action on the right of the top app bar (e.g. Save) */
  action?: { label: string; onClick: () => void; disabled?: boolean };
  headerActions?: ReactNode;
  leading?: "close" | "back";
  children: ReactNode;
}) => {
  const back = onBack ?? onClose;
  useMobileBackHandler(open, back);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && back()}>
      <DialogContent
        hideClose
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="grid-rows-[minmax(0,1fr)] overflow-hidden border-0 p-0 shadow-none"
      >
        <M3Provider>
          <FullScreenBody
            title={title}
            back={back}
            action={action}
            headerActions={headerActions}
            leading={leading}
          >
            {children}
          </FullScreenBody>
        </M3Provider>
      </DialogContent>
    </Dialog>
  );
};

const FullScreenBody = ({
  title,
  back,
  action,
  headerActions,
  leading,
  children,
}: {
  title: string;
  back: () => void;
  action?: { label: string; onClick: () => void; disabled?: boolean };
  headerActions?: ReactNode;
  leading: "close" | "back";
  children: ReactNode;
}) => {
  const t = useM3();
  const [scrolled, setScrolled] = useState(false);

  return (
    <Box
      sx={{
        position: "relative",
        height: "100%",
        minWidth: 0,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: t.surface,
        color: t.onSurface,
        fontFamily: "Roboto, system-ui, sans-serif",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          height: 64,
          px: 0.5,
          flexShrink: 0,
          bgcolor: scrolled ? t.surfaceContainer : t.surface,
          transition: `background-color 200ms ${EASE}`,
        }}
      >
        <M3IconButton
          icon={leading === "close" ? <CloseIcon /> : <ArrowBackIcon />}
          label={leading === "close" ? "Close" : "Back"}
          onClick={back}
          color={t.onSurface}
        />
        <DialogTitle asChild>
          <Box
            component="h2"
            sx={{
              m: 0,
              flex: 1,
              minWidth: 0,
              fontSize: "1.375rem",
              fontWeight: 400,
              lineHeight: "28px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </Box>
        </DialogTitle>
        {headerActions}
        {action && (
          <Box sx={{ pr: 1 }}>
            <M3Button variant="text" onClick={action.onClick} disabled={action.disabled}>
              {action.label}
            </M3Button>
          </Box>
        )}
      </Box>
      <Box
        onScroll={(e) => setScrolled((e.currentTarget as HTMLDivElement).scrollTop > 4)}
        sx={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", px: 2, pb: 4 }}
      >
        {children}
      </Box>
    </Box>
  );
};

/* ------------------------------------------------------------------ */
/* Single-choice picker state shared by form screens                   */
/* ------------------------------------------------------------------ */

export interface M3PickerRequest {
  title: string;
  options: M3Option[];
  value: string;
  onConfirm: (value: string) => void;
}

export function useM3Picker() {
  const [picker, setPicker] = useState<M3PickerRequest | null>(null);
  const element = (
    <M3SelectDialog
      open={!!picker}
      title={picker?.title ?? ""}
      options={picker?.options ?? []}
      value={picker?.value ?? ""}
      onDismiss={() => setPicker(null)}
      onConfirm={(v) => {
        picker?.onConfirm(v);
        setPicker(null);
      }}
    />
  );
  return { isOpen: !!picker, open: setPicker, close: () => setPicker(null), element };
}

/** List row that shows the current choice and opens a single-choice dialog. */
export const M3SelectItem = ({
  title,
  value,
  options,
  onChange,
  openPicker,
  divider = true,
}: {
  title: string;
  value: string;
  options: M3Option[];
  onChange: (value: string) => void;
  openPicker: (req: M3PickerRequest) => void;
  divider?: boolean;
}) => (
  <M3ListItem
    headline={title}
    supporting={options.find((o) => o.value === value)?.label ?? value}
    divider={divider}
    onClick={() => openPicker({ title, options, value, onConfirm: onChange })}
  />
);

/** List row with a trailing switch; the whole row toggles. */
export const M3SwitchItem = ({
  title,
  supporting,
  checked,
  onChange,
  divider = true,
  disabled,
}: {
  title: string;
  supporting?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  divider?: boolean;
  disabled?: boolean;
}) => (
  <M3ListItem
    headline={title}
    supporting={supporting}
    divider={divider}
    onClick={disabled ? undefined : () => onChange(!checked)}
    trailing={
      <M3Switch checked={checked} onChange={onChange} ariaLabel={title} disabled={disabled} />
    }
  />
);

/** Grouped list container (Android Settings style). */
export const M3ListGroup = ({ children }: { children: ReactNode }) => {
  const t = useM3();
  return (
    <Box sx={{ bgcolor: t.surfaceContainer, borderRadius: "24px", overflow: "hidden", mb: 2 }}>
      {children}
    </Box>
  );
};

/* ------------------------------------------------------------------ */
/* List items — https://m3.material.io/components/lists/specs          */
/* ------------------------------------------------------------------ */

export const M3ListItem = ({
  headline,
  supporting,
  leading,
  trailing,
  onClick,
  divider,
}: {
  headline: ReactNode;
  supporting?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  divider?: boolean;
}) => {
  const t = useM3();
  const content = (
    <>
      {leading && (
        <Box sx={{ display: "flex", color: t.onSurfaceVariant, flexShrink: 0 }}>{leading}</Box>
      )}
      <Box sx={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <Box
          sx={{
            fontSize: "1rem",
            lineHeight: "24px",
            letterSpacing: "0.5px",
            color: t.onSurface,
          }}
        >
          {headline}
        </Box>
        {supporting && (
          <Box
            sx={{
              fontSize: "0.875rem",
              lineHeight: "20px",
              letterSpacing: "0.25px",
              color: t.onSurfaceVariant,
            }}
          >
            {supporting}
          </Box>
        )}
      </Box>
      {trailing && <Box sx={{ flexShrink: 0, display: "flex" }}>{trailing}</Box>}
    </>
  );

  const sx = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 2,
    minHeight: supporting ? 72 : 56,
    px: 2.5,
    py: 1,
    fontFamily: "Roboto, system-ui, sans-serif",
    borderBottom: divider ? `1px solid ${alpha(t.outlineVariant, 0.6)}` : "none",
  } as const;

  if (!onClick) return <Box sx={sx}>{content}</Box>;
  return (
    <ButtonBase onClick={onClick} sx={{ ...sx, justifyContent: "flex-start" }}>
      {content}
    </ButtonBase>
  );
};

export const M3Subheader = ({ children }: { children: ReactNode }) => {
  const t = useM3();
  return (
    <Box
      sx={{
        px: 2.5,
        pt: 2,
        pb: 1,
        fontSize: "0.875rem",
        fontWeight: 500,
        letterSpacing: "0.1px",
        color: t.primary,
        fontFamily: "Roboto, system-ui, sans-serif",
      }}
    >
      {children}
    </Box>
  );
};
