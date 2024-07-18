import { Navbar } from './navbar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className='m-2'>
      <Navbar />
      {children}
    </div>
  );
};
