import {
    X,
    Play,
    Database,
    ChevronRight,
    RotateCcw,
    Trash2,
    Search,
    CircleX,
} from 'lucide-preact'; // import only what you need

type IconName =
    | 'x'
    | 'play'
    | 'database'
    | 'chevron-right'
    | 'rotate-ccw'
    | 'trash'
    | 'search'
    | 'circle-x';

const ICON_MAP: Record<IconName, any> = {
    x: X,
    play: Play,
    database: Database,
    'chevron-right': ChevronRight,
    'rotate-ccw': RotateCcw,
    trash: Trash2,
    search: Search,
    'circle-x': CircleX,
};

interface IconProps {
    name: IconName;
    size?: number | string;
    color?: string;
    className?: string;
}

export default function Icon({ name, size = 16, color, className }: IconProps) {
    const Cmp = ICON_MAP[name];
    if (!Cmp) return null;
    return <Cmp size={size} color={color} className={className} />;
}
