import { useGame } from './App';
import { useT } from './i18n';
import { DoorIcon, GearIcon, PlayIcon } from './icons';

export function PauseMenu({ openSettings }: { openSettings: () => void }) {
  const game = useGame();
  const { t } = useT();
  return (
    <div className='bf-screen-in absolute inset-0 z-20 grid place-items-center bg-[#0b1222]/55 backdrop-blur-sm'>
      <div className='bf-panel bf-studs bf-pop flex w-[320px] flex-col gap-4 p-6'>
        <button className='bf-btn bf-btn-primary !h-16' onClick={() => game.resume()}>
          <PlayIcon size={26} />
          <span className='bf-display text-3xl'>{t('resume')}</span>
        </button>
        <button className='bf-btn bf-btn-blue' onClick={openSettings}>
          <GearIcon size={20} />
          <span className='font-semibold'>{t('settings')}</span>
        </button>
        <button className='bf-btn bf-btn-red' onClick={() => game.leave()}>
          <DoorIcon size={20} />
          <span className='font-semibold'>{t('leaveMatch')}</span>
        </button>
      </div>
    </div>
  );
}
