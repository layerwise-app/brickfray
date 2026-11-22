import { CHARACTER_IDS, ROSTER } from '../../characters/roster';
import type { CharacterId } from '../../characters/types';
import type { Avatar as AvatarData } from '../../../lib/board/contract';
import type { BotKind } from '../../characters/types';
import { useApp } from '../App';
import { BotFace } from '../hud/SoloHud';
import './avatar.css';

const BOTS: ReadonlySet<string> = new Set<BotKind>(['grunt', 'rusher', 'sniper', 'boss']);

function hero(id: string | null | undefined): CharacterId {
  return CHARACTER_IDS.includes(id as CharacterId) ? (id as CharacterId) : 'rivet';
}

/** A player's picture: their upload, else their chosen portrait, else the character they played (a snapbot's face). */
export function Avatar({ avatar, character, size = 40, className = '' }: { avatar?: AvatarData | null; character?: string | null; size?: number; className?: string }) {
  const app = useApp();
  const style = { ['--av' as string]: `${size}px` };
  if (!avatar && character && BOTS.has(character)) {
    return (
      <span className={`bf-av bf-av-bot ${className}`} style={style}>
        <BotFace kind={character as BotKind} size={Math.round(size * 0.84)} />
      </span>
    );
  }
  if (avatar?.image) {
    return (
      <span className={`bf-av ${className}`} style={style}>
        <img src={avatar.image} alt='' draggable={false} />
      </span>
    );
  }
  const id = hero(avatar?.hero ?? character);
  const info = ROSTER[id];
  return (
    <span className={`bf-av bf-av-hero ${className}`} style={{ ...style, background: `linear-gradient(160deg, ${info.primary} 0 calc(66% - 0.7px), ${info.secondary} calc(66% + 0.7px) 100%)` }}>
      {app.portraits[id] && <img src={app.portraits[id]} alt='' draggable={false} />}
    </span>
  );
}

export function PendingButton({ pending, className = '', children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pending: boolean }) {
  return (
    <button {...rest} className={`bf-btn ${className}`} disabled={pending || rest.disabled} aria-busy={pending}>
      {pending && <span className='bf-av-spin' aria-hidden />}
      <span className='font-bold'>{children}</span>
    </button>
  );
}
