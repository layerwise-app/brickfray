import { createFileRoute } from '@tanstack/react-router';
import { DoodleDistrict } from '~/components/DoodleDistrict';
import { seo } from '~/utils/seo';

const homePageTitle = '涂鸦街区';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      ...seo({
        title: homePageTitle,
        description: '一款涂鸦风第一人称生存射击游戏，复刻自 doodleshooter'
      })
    ]
  }),
  component: Home
});

function Home() {
  return <DoodleDistrict />;
}
