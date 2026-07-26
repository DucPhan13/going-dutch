interface AvatarProps {
  name: string;
  className?: string;
}

const AVATAR_COLORS = [
  'bg-emerald-600',
  'bg-indigo-600',
  'bg-violet-600',
  'bg-sky-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-teal-600',
  'bg-pink-600',
];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export default function Avatar({ name, className = 'w-8 h-8' }: AvatarProps) {
  const color = getColorForName(name);
  const initials = getInitials(name);

  return (
    <span className={`inline-flex items-center justify-center rounded-lg text-xs font-semibold text-white ${color} ${className}`}>
      {initials}
    </span>
  );
}
