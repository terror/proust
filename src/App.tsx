import { Route, Routes } from 'react-router-dom';

import { Home } from './pages/home';
import { Workspace } from './pages/workspace';

const App: React.FC = () => {
  return (
    <Routes>
      <Route index path='/' element={<Home />} />
      <Route path='/workspace' element={<Workspace />} />
    </Routes>
  );
};

export default App;
