import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DashboardIcon } from "./DashboardIcons.jsx";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKey(value) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatFieldDate(value) {
  const parsed = parseDateKey(value);
  return parsed ? parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
}

// Apple Calendar-style month-grid date picker. Replaces native
// <input type="date">; onChange receives a plain "YYYY-MM-DD" string, same
// format the native input already produced, so callers only need to swap
// the element and drop the `event.target.value` unwrap.
export function AppleDateField({ value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const [viewMonth, setViewMonth] = useState(() => {
    const parsed = parseDateKey(value);
    const base = parsed || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const triggerRef = useRef(null);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 300;
    const viewportPadding = 12;
    const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - width - viewportPadding);
    const top = rect.bottom + 8;
    setPosition({ left, top, width });
  }, []);

  function closePopover() {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function openPopover() {
    if (disabled) return;
    const parsed = parseDateKey(value);
    const base = parsed || new Date();
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    updatePosition();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        closePopover();
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const monthLabel = viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = dateKey(new Date());
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function selectDay(day) {
    onChange(dateKey(new Date(year, month, day)));
    closePopover();
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => (open ? closePopover() : openPopover())}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        className="apple-date-field-trigger"
        style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
      >
        <DashboardIcon name="calendar" size={13} strokeWidth={1.9} />
        {value ? formatFieldDate(value) : "Select date"}
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 1800 }} onClick={closePopover} />
              <div
                className="apple-calendar-pop"
                role="dialog"
                aria-label="Select date"
                style={{ position: "fixed", top: position.top, left: position.left, width: position.width }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="apple-calendar-header">
                  <span className="apple-calendar-month">{monthLabel}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      type="button"
                      aria-label="Previous month"
                      onClick={() => setViewMonth(new Date(year, month - 1, 1))}
                      className="apple-calendar-nav"
                    >
                      <DashboardIcon name="chevron" size={13} strokeWidth={2.2} style={{ transform: "rotate(180deg)" }} />
                    </button>
                    <button
                      type="button"
                      aria-label="Next month"
                      onClick={() => setViewMonth(new Date(year, month + 1, 1))}
                      className="apple-calendar-nav"
                    >
                      <DashboardIcon name="chevron" size={13} strokeWidth={2.2} />
                    </button>
                  </div>
                </div>

                <div className="apple-calendar-weekdays">
                  {WEEKDAY_LABELS.map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>

                <div className="apple-calendar-grid">
                  {cells.map((day, index) => {
                    if (!day) return <span key={`empty-${index}`} />;
                    const key = dateKey(new Date(year, month, day));
                    const isSelected = value === key;
                    const isToday = todayKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => selectDay(day)}
                        className={`apple-calendar-day ${isSelected ? "is-selected" : ""} ${isToday && !isSelected ? "is-today" : ""}`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

// Shared trigger + portal-popover-listbox plumbing behind every Apple-menu-
// style picker (dropdown filters, dispatcher picker, route mode picker) -
// only the trigger's own markup and each row's visual treatment differ
// between consumers, everything else (position, open/close, arrow-key nav,
// Escape, outside-click) is identical, so it's factored out once here. The
// native <select> this replaces gave click/keyboard/touch accessibility
// "for free"; rebuilt here with role="listbox"/"option" plus arrow-key +
// Enter/Escape support so swapping to a custom menu doesn't regress that.
export function PopoverListMenu({ trigger, renderRow, options, value, onChange, menuClassName, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const selectedIndex = Math.max(0, options.findIndex((option) => option.key === value));

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.max(rect.width, 220);
    const viewportPadding = 12;
    const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - width - viewportPadding);
    const top = rect.bottom + 8;
    setPosition({ left, top, width });
  }, []);

  function closeMenu() {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function openMenu() {
    setHighlightIndex(selectedIndex);
    updatePosition();
    setOpen(true);
  }

  function choose(option) {
    onChange(option.key);
    closeMenu();
  }

  useEffect(() => {
    if (!open) return undefined;
    window.requestAnimationFrame(() => menuRef.current?.focus());

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightIndex((current) => Math.min(options.length - 1, current + 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightIndex((current) => Math.max(0, current - 1));
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const option = options[highlightIndex];
        if (option) choose(option);
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, highlightIndex, options, updatePosition]);

  return (
    <div style={{ position: "relative" }}>
      {trigger({ open, onClick: () => (open ? closeMenu() : openMenu()), triggerRef })}

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 1800 }} onClick={closeMenu} />
              <div
                ref={menuRef}
                role="listbox"
                tabIndex={-1}
                aria-label={ariaLabel}
                className={menuClassName}
                style={{ position: "fixed", top: position.top, left: position.left, width: position.width }}
                onClick={(event) => event.stopPropagation()}
              >
                {options.map((option, index) =>
                  renderRow(option, {
                    isSelected: option.key === value,
                    isHighlighted: index === highlightIndex,
                    onClick: () => choose(option),
                    onMouseEnter: () => setHighlightIndex(index),
                  }),
                )}
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

// Drop-in replacement for the shared `Dropdown` component (same prop
// signature) that swaps the native <select> for a macOS-menu-style popover:
// one row per option, checkmark on the selected row, thin dividers between
// rows. The trigger pill keeps Dropdown's existing visual treatment
// (icon-left, chevron-right, rounded pill) so toolbars don't shift - only
// the opened panel looks different.
export function AppleDropdown({ value, options, onChange, placeholder = "Select", icon = "", style = {} }) {
  const selectedOption = options.find((option) => option.key === value);

  return (
    <div style={{ position: "relative", ...style }}>
      <PopoverListMenu
        ariaLabel={placeholder}
        menuClassName="apple-dropdown-menu"
        options={options}
        value={value}
        onChange={onChange}
        trigger={({ open, onClick, triggerRef }) => (
          <button
            type="button"
            ref={triggerRef}
            onClick={onClick}
            aria-haspopup="listbox"
            aria-expanded={open}
            className="apple-dropdown-menu-trigger"
          >
            {icon ? <DashboardIcon name={icon} size={13} strokeWidth={1.8} /> : null}
            <span>{selectedOption?.label || placeholder}</span>
            <DashboardIcon name="chevron" size={11} strokeWidth={2} style={{ transform: "rotate(90deg)", marginLeft: "auto" }} />
          </button>
        )}
        renderRow={(option, { isSelected, isHighlighted, onClick, onMouseEnter }) => (
          <button
            key={option.key}
            type="button"
            role="option"
            aria-selected={isSelected}
            onMouseEnter={onMouseEnter}
            onClick={onClick}
            className={`apple-dropdown-menu-row ${isHighlighted ? "is-highlighted" : ""}`}
          >
            <span>{option.label}</span>
            {isSelected ? <DashboardIcon name="checkmark" size={14} strokeWidth={2.4} style={{ color: "var(--color-azure, #0071e3)" }} /> : null}
          </button>
        )}
      />
    </div>
  );
}
