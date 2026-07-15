import React from "react";

export const IconShell = ({ children }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

export const ArrowIcon = () => (
  <IconShell>
    <path d="M5 12h13" />
    <path d="m13 6 6 6-6 6" />
  </IconShell>
);

export const SearchIcon = () => (
  <IconShell>
    <circle cx="11" cy="11" r="6" />
    <path d="m16 16 4 4" />
  </IconShell>
);

export const PaletteIcon = () => (
  <IconShell>
    <path d="M12 4a8 8 0 1 0 8 8c0-1.2-.9-2-2.1-2H16a2 2 0 0 1-2-2V6.1C14 4.9 13.2 4 12 4Z" />
    <circle cx="8.4" cy="11.1" r=".7" />
    <circle cx="10.8" cy="8.3" r=".7" />
    <circle cx="14.1" cy="15.2" r=".7" />
  </IconShell>
);

export const TextureIcon = () => (
  <IconShell>
    <path d="M4 8c4-3 8 3 16 0" />
    <path d="M4 12c4-3 8 3 16 0" />
    <path d="M4 16c4-3 8 3 16 0" />
  </IconShell>
);

export const CalculatorIcon = () => (
  <IconShell>
    <rect x="6" y="3" width="12" height="18" rx="3" />
    <path d="M9 7h6" />
    <path d="M9 11h.01" />
    <path d="M12 11h.01" />
    <path d="M15 11h.01" />
    <path d="M9 15h.01" />
    <path d="M12 15h.01" />
    <path d="M15 15h.01" />
  </IconShell>
);

export const StoreIcon = () => (
  <IconShell>
    <path d="M5 10h14l-1-5H6l-1 5Z" />
    <path d="M7 10v9h10v-9" />
    <path d="M10 19v-5h4v5" />
  </IconShell>
);

export const ShieldIcon = () => (
  <IconShell>
    <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
    <path d="m9.5 12 1.7 1.7 3.8-4" />
  </IconShell>
);

export const SupportIcon = () => (
  <IconShell>
    <path d="M5 12a7 7 0 0 1 14 0" />
    <path d="M5 12v3a2 2 0 0 0 2 2h1v-6H7a2 2 0 0 0-2 2Z" />
    <path d="M19 12v3a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2Z" />
    <path d="M9 19h3" />
  </IconShell>
);

export const PhoneIcon = () => (
  <IconShell>
    <path d="M7 4 5 6c-.7.7-.7 1.7-.2 2.5 2.4 4 5.7 7.3 9.7 9.7.8.5 1.8.5 2.5-.2l2-2-3.2-3.2-1.7 1.7c-2-1.1-3.5-2.6-4.6-4.6l1.7-1.7L7 4Z" />
  </IconShell>
);

export const MailIcon = () => (
  <IconShell>
    <rect x="4" y="6" width="16" height="12" rx="2" />
    <path d="m5 8 7 5 7-5" />
  </IconShell>
);

export const LeafIcon = () => (
  <IconShell>
    <path d="M20 4c-8 0-13 4-13 10a6 6 0 0 0 6 6c6 0 8-8 7-16Z" />
    <path d="M7 17c2-5 6-8 11-10" />
  </IconShell>
);

export const TruckIcon = () => (
  <IconShell>
    <path d="M4 6h10v10H4V6Z" />
    <path d="M14 10h3l3 3v3h-6v-6Z" />
    <circle cx="8" cy="18" r="1.5" />
    <circle cx="17" cy="18" r="1.5" />
  </IconShell>
);

export const UserIcon = () => (
  <IconShell>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" />
  </IconShell>
);

export const EditIcon = () => (
  <IconShell>
    <path d="M16.5 4.5 19.5 7.5 8 19H5v-3L16.5 4.5Z" />
  </IconShell>
);

export const LockIcon = () => (
  <IconShell>
    <rect x="5" y="11" width="14" height="9" rx="2.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </IconShell>
);

export const EyeIcon = () => (
  <IconShell>
    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
    <circle cx="12" cy="12" r="3" />
  </IconShell>
);

export const EyeOffIcon = () => (
  <IconShell>
    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
    <circle cx="12" cy="12" r="3" />
    <path d="M4 4l16 16" />
  </IconShell>
);

export const CreditCardIcon = () => (
  <IconShell>
    <rect x="3" y="6" width="18" height="13" rx="2.5" />
    <path d="M3 10.5h18" />
    <path d="M6.5 15h4" />
  </IconShell>
);

export const CheckCircleIcon = () => (
  <IconShell>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12.3 2.3 2.3 4.7-5" />
  </IconShell>
);

export const PinIcon = () => (
  <IconShell>
    <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.4" />
  </IconShell>
);

export const DocumentIcon = () => (
  <IconShell>
    <path d="M7 3h7l4 4v14H7V3Z" />
    <path d="M14 3v5h4" />
    <path d="M9.5 12h5" />
    <path d="M9.5 16h5" />
  </IconShell>
);

