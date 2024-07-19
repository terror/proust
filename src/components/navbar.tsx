import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '@/components/ui/navigation-menu';
import { Link } from 'react-router-dom';

import { ModeToggle } from './mode-toggle';

export const Navbar = () => {
  return (
    <div className='flex items-center justify-between p-4'>
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <Link to='/' className='flex flex-col items-start'>
              <NavigationMenuLink>
                  <span className='text-xl font-semibold'>proust</span>
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
      <ModeToggle />
    </div>
  );
};
