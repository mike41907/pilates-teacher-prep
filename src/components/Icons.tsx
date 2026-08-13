import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({
  size = 20,
  children,
  ...props
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v11h14V9" />
      <path d="M9 20v-6h6v6" />
    </Icon>
  );
}
export function PlannerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </Icon>
  );
}
export function LibraryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5z" />
      <path d="M5 4.5v17M9 6h7M9 10h7" />
    </Icon>
  );
}
export function BrainIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 4.5a3 3 0 0 0-5 2.2A3.2 3.2 0 0 0 4 13a3.1 3.1 0 0 0 2.5 5.4A3.2 3.2 0 0 0 12 19V6.5a3 3 0 0 0-2.5-2Z" />
      <path d="M14.5 4.5a3 3 0 0 1 5 2.2A3.2 3.2 0 0 1 20 13a3.1 3.1 0 0 1-2.5 5.4A3.2 3.2 0 0 1 12 19V6.5a3 3 0 0 1 2.5-2Z" />
      <path d="M8 8h2M6.5 13H9M15 8h2M15 13h2M12 10v5" />
    </Icon>
  );
}
export function CoursesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
      <path d="M4 5.5v16M8 7h8M8 11h8M8 15h5" />
    </Icon>
  );
}
export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
      <path
        d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3.1 1.3v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3.1-1.3l-.1.1a1.8 1.8 0 0 1-2.5-2.5l.1-.1A1.8 1.8 0 0 0 3.3 12a1.8 1.8 0 0 0-1.7-1.8 1.8 1.8 0 0 1 0-3.6h.2A1.8 1.8 0 0 0 3.1 3.5L3 3.4A1.8 1.8 0 0 1 5.5.9l.1.1A1.8 1.8 0 0 0 8.7 0v-.2a1.8 1.8 0 0 1 3.6 0V0a1.8 1.8 0 0 0 3.1 1.3l.1-.1A1.8 1.8 0 0 1 18 3.7l-.1.1a1.8 1.8 0 0 0 1.3 3.1h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-1.3 3.1Z"
        transform="translate(1 2) scale(.91)"
      />
    </Icon>
  );
}
export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}
export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.5 4.5" />
    </Icon>
  );
}
export function StarIcon({
  filled = false,
  ...props
}: IconProps & { filled?: boolean }) {
  return (
    <Icon {...props}>
      <path
        fill={filled ? "currentColor" : "none"}
        d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"
      />
    </Icon>
  );
}
export function MoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="5" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="19" cy="12" r="1" fill="currentColor" />
    </Icon>
  );
}
export function ArrowLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m15 18-6-6 6-6" />
    </Icon>
  );
}
export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9 18 6-6-6-6" />
    </Icon>
  );
}
export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}
export function ChevronUpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m18 15-6-6-6 6" />
    </Icon>
  );
}
export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  );
}
export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12 4 4L19 6" />
    </Icon>
  );
}
export function DragIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01"
        strokeWidth="3"
      />
    </Icon>
  );
}
export function PlayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path fill="currentColor" stroke="none" d="m8 5 11 7-11 7z" />
    </Icon>
  );
}
export function EditIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4 16-.7 4.7L8 20l11.2-11.2a2.1 2.1 0 0 0-3-3z" />
      <path d="m14.7 7.3 2 2" />
    </Icon>
  );
}
export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </Icon>
  );
}
export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </Icon>
  );
}
export function DownloadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />
    </Icon>
  );
}
export function UploadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
    </Icon>
  );
}
export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
  );
}
export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19.5 15.7A8 8 0 0 1 8.3 4.5 8.2 8.2 0 1 0 19.5 15.7Z" />
    </Icon>
  );
}
export function MonitorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </Icon>
  );
}
export function VolumeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 10v4h3l4 3V7l-4 3zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
    </Icon>
  );
}
export function MaximizeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5" />
      <path d="M3 3l6 6M21 3l-6 6M3 21l6-6M21 21l-6-6" />
    </Icon>
  );
}
