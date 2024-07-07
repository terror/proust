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
            <Link to='/' className='text-xl font-semibold'>
              <NavigationMenuLink>
                proust{' '}
                <p className='text-sm italic text-muted-foreground'>
                  a learning tool
                </p>
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
      <ModeToggle />
    </div>
  );
};
